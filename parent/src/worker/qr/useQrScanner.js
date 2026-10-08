import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { closeScanQr, haptic, offTgEvent, onTgEvent, qrScanSupport, showScanQr } from "../../lib/telegram";
import { scanSound } from "../../lib/scanSound";
import { workerApi } from "../api";
import { QR_RESCAN_COOLDOWN } from "../constants";
import { errText } from "../utils";

const MAX_RESULTS = 50;
const EMPTY_STATS = { total: 0, present: 0, late: 0, duplicate: 0, error: 0 };

// Telegram'ning o'z QR skaneri bilan davomat (API_CONTRACT_worker_qr_attendance.md §3).
// - Popup YOPILMASDAN ketma-ket o'qiydi (callback `false`).
// - Bir xil kod 3 soniya ichida qayta o'qilsa e'tiborsiz.
// - Navbat: bir vaqtda faqat bitta so'rov, keyingi kod oldingisini kutadi.
// - `needsGroup` — popup yopiladi, `choice` beriladi; tanlangach `groupId`
//   bilan qayta yuboriladi va skaner qayta ochiladi.
// Sessiya (natijalar/statistika) faqat xotirada — sahifadan chiqsa tozalanadi.
export const useQrScanner = ({ enabled = true } = {}) => {
  const { t } = useTranslation();
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState([]);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [choice, setChoice] = useState(null); // { token, student, groups }

  const queueRef = useRef([]);
  const runningRef = useRef(false);
  const pausedRef = useRef(false); // guruh tanlash kutilmoqda
  const reopenRef = useRef(false); // tanlovdan keyin skanerni qayta ochish
  const scanningRef = useRef(false);
  const mountedRef = useRef(false);
  const lastRef = useRef({ token: "", at: 0 });
  const seqRef = useRef(0);
  const textRef = useRef(() => false);

  const push = useCallback((entry) => {
    seqRef.current += 1;
    const item = { id: seqRef.current, at: Date.now(), ...entry };
    setResults((list) => [item, ...list].slice(0, MAX_RESULTS));
    setStats((s) => ({
      ...s,
      total: s.total + 1,
      [entry.kind]: (s[entry.kind] || 0) + 1,
    }));
  }, []);

  const report = useCallback(
    (data) => {
      const name = data?.student?.fullName || "";
      const kind = data?.duplicate ? "duplicate" : data?.late ? "late" : "present";
      if (kind === "duplicate") {
        haptic("warning");
        scanSound.duplicate();
        toast.warning(name, { description: t("attendance.alreadyMarked") });
      } else {
        haptic("success");
        if (kind === "late") scanSound.late();
        else scanSound.success();
        toast.success(name, { description: t(kind === "late" ? "attendance.markedLate" : "attendance.marked") });
      }
      push({ kind, name, subject: data?.subject || "", groupId: data?.groupId || "" });
    },
    [t, push],
  );

  // Navbatni ketma-ket ishlaydi. Guruh tanlash kutilayotganda to'xtaydi.
  const drain = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setBusy(true);
    try {
      while (queueRef.current.length && !pausedRef.current && mountedRef.current) {
        const item = queueRef.current.shift();
        try {
          const data = await workerApi.qrScan(item.token, item.groupId);
          if (!mountedRef.current) break;
          if (data?.needsGroup) {
            pausedRef.current = true;
            reopenRef.current = scanningRef.current;
            closeScanQr();
            // Dasturiy yopishda event kelmasligi mumkin — holatni o'zimiz tiklaymiz.
            scanningRef.current = false;
            setScanning(false);
            haptic("warning");
            scanSound.attention();
            setChoice({ token: item.token, student: data.student || null, groups: data.groups || [] });
            break;
          }
          report(data);
        } catch (e) {
          if (!mountedRef.current) break;
          const msg = errText(e);
          haptic("error");
          scanSound.error();
          toast.error(msg);
          push({ kind: "error", name: msg });
        }
      }
    } finally {
      runningRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  }, [report, push]);

  const onText = useCallback(
    (text) => {
      const token = String(text || "").trim();
      if (!token || pausedRef.current) return false;
      const now = Date.now();
      const last = lastRef.current;
      if (last.token === token && now - last.at < QR_RESCAN_COOLDOWN) return false;
      lastRef.current = { token, at: now };
      queueRef.current.push({ token });
      drain();
      return false; // popup ochiq qoladi — keyingi karta
    },
    [drain],
  );

  useEffect(() => {
    textRef.current = onText;
  }, [onText]);

  const start = useCallback(() => {
    if (!enabled || !mountedRef.current || scanningRef.current || pausedRef.current || qrScanSupport() !== "ok") return false;
    const ok = showScanQr(t("worker.qr.popupText"), (text) => textRef.current(text));
    if (ok) {
      scanningRef.current = true;
      setScanning(true);
      haptic("light");
    }
    return ok;
  }, [enabled, t]);

  const stop = useCallback(() => {
    closeScanQr();
    scanningRef.current = false;
    setScanning(false);
  }, []);

  const chooseGroup = useCallback(
    async (groupId) => {
      if (!choice) return;
      const { token } = choice;
      const reopen = reopenRef.current;
      reopenRef.current = false;
      setChoice(null);
      pausedRef.current = false;
      queueRef.current.unshift({ token, groupId });
      await drain();
      if (reopen && mountedRef.current && !pausedRef.current) start();
    },
    [choice, drain, start],
  );

  const cancelChoice = useCallback(() => {
    reopenRef.current = false;
    setChoice(null);
    pausedRef.current = false;
    drain();
  }, [drain]);

  // Foydalanuvchi (yoki biz) popupni yopsa — holat tiklanadi.
  useEffect(() => {
    mountedRef.current = true;
    const onClosed = () => {
      scanningRef.current = false;
      setScanning(false);
    };
    onTgEvent("scanQrPopupClosed", onClosed);
    return () => {
      mountedRef.current = false;
      offTgEvent("scanQrPopupClosed", onClosed);
      if (scanningRef.current) closeScanQr();
      scanningRef.current = false;
      queueRef.current = [];
    };
  }, []);

  return { scanning, busy, results, stats, choice, start, stop, chooseGroup, cancelChoice };
};
