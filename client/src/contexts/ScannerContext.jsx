import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { HiClock, HiVideoCameraSlash } from "react-icons/hi2";
import jsQR from "jsqr";
import Dialog from "../ui/Dialog";
import Button from "../ui/Button";
import useCan from "../hooks/useCan";
import useFeature from "../hooks/useFeature";
import useFaceRecognition from "../hooks/useFaceRecognition";
import useQrScanner from "../hooks/useQrScanner";
import useMediaQuery from "../hooks/useMediaQuery";
import { api } from "../utils/fetching";
import { errorMsg } from "../utils/alert";
import { scanSound } from "../utils/scanSound";
import { ScannerContext } from "./scanner";

// Bir xil QR kamera oldida turganda sekundiga o'nlab marta o'qiladi — shu
// muddat ichida takroriy skan e'tiborga olinmaydi.
const RESCAN_COOLDOWN = 3000;
// QR har kadrda emas — ~8 marta/s yetarli; kadr 800px gacha kichraytiriladi
// (to'liq o'lchamli getImageData + jsQR asosiy oqimni qotirardi).
const QR_INTERVAL = 120;
const QR_MAX_SIZE = 800;
// Yuz aniqlash kadrlar tezligida emas (og'ir hisob) — shu oraliqda bir marta.
// Yuz topilmayotgan paytda (bo'sh kadr) sekinroq: kamera oldida odam yo'q.
const FACE_INTERVAL = 300;
const FACE_IDLE_INTERVAL = 700;
// Bir o'quvchi ketma-ket shuncha tekshiruvda mos chiqsagina belgilanadi.
const FACE_CONFIRM_FRAMES = 3;
// Odam kamera oldida turib qolsa takroriy xabar chiqmasligi uchun.
const FACE_COOLDOWN = 20000;
const HISTORY_LIMIT = 20;
// Tasvir shuncha soniya o'zgarmasa kamera "qotgan" hisoblanadi.
const FREEZE_TICKS = 3;
// Fon tabda sikl shu oraliqda aylanadi (brauzer baribir ~1s gacha cheklaydi) — QR uchun yetarli.
const BACKGROUND_TICK = 500;
// Kamera yoqilganligi brauzerda eslab qolinadi — sahifa yangilansa qayta yonadi.
const STORAGE_PREFIX = "wenet:scanner:";

// Belgi foydalanuvchiga bog'langan — umumiy kompyuterda keyingi hodim kirsa
// kamera o'zi yonib qolmasin.
const readStored = (userId) => {
  try {
    return !!userId && localStorage.getItem(STORAGE_PREFIX + userId) === "1";
  } catch {
    return false;
  }
};
const writeStored = (userId, on) => {
  try {
    if (userId) localStorage.setItem(STORAGE_PREFIX + userId, on ? "1" : "0");
  } catch {
    // private rejim — eslab qolinmaydi, ish buzilmaydi
  }
};

/**
 * Davomat skaneri butun ilova bo'ylab (docs/API_CONTRACT_global_scanner.md):
 * kamera (QR + yuz) Top paneldagi tugma bilan yoqiladi va sahifa almashganda
 * to'xtamaydi; apparat skaner ham shu yerda tinglanadi. Natija toast bilan
 * ko'rsatiladi, "Davomat" sahifasi esa shu holatni (tarix, natija) o'qiydi.
 */
export function ScannerProvider({ children }) {
  const { t } = useTranslation();
  const can = useCan();
  const hasFeature = useFeature();
  const { _id: userId, authType, subscriptionActive } = useSelector((e) => e.user);
  // Telefonda doimiy kamera yo'q — faqat "Davomat" sahifasida (Top bilan bir xil chegara).
  const isPhone = useMediaQuery("(max-width: 639px)");
  const { pathname } = useLocation();

  // Obuna tugagan bo'lsa backend baribir bloklaydi — skan qilinaverib
  // bekorga xato chiqmasligi kerak.
  const available =
    can("attendance:create") && hasFeature("attendance.qr") && !(authType === "staff" && subscriptionActive === false);
  const faceOn = hasFeature("attendance.face");

  const engineVideoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  // Sikl: ko'rinib turgan tabda requestAnimationFrame, fon tabda (rAF to'xtaydi) setTimeout.
  const loopRef = useRef({ raf: 0, timer: 0 });
  const tickRef = useRef(null);
  const lastTokenRef = useRef({ token: "", at: 0 });
  const busyRef = useRef(false);
  const faceRef = useRef({ at: 0, running: false, candidate: "", hits: 0, cooldown: {}, idle: false });
  const qrAtRef = useRef(0);

  const [scanning, setScanning] = useState(false);
  const [stream, setStream] = useState(null);
  const [cameraError, setCameraError] = useState("");
  // Kamera muammosi: "missing" | "denied" | "busy" | "lost" — modal shu bo'yicha chiqadi.
  const [cameraIssue, setCameraIssue] = useState(null);
  const [issueOpen, setIssueOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [groupChoice, setGroupChoice] = useState(null);
  const [scannerSeen, setScannerSeen] = useState(false);

  const face = useFaceRecognition(faceOn && scanning);
  const faceDetectRef = useRef(face.detect);
  useEffect(() => {
    faceDetectRef.current = face.detect;
  }, [face.detect]);

  const cancelLoop = useCallback(() => {
    cancelAnimationFrame(loopRef.current.raf);
    clearTimeout(loopRef.current.timer);
  }, []);
  const scheduleLoop = useCallback(() => {
    cancelLoop();
    const run = () => tickRef.current?.();
    if (document.hidden) loopRef.current.timer = setTimeout(run, BACKGROUND_TICK);
    else loopRef.current.raf = requestAnimationFrame(run);
  }, [cancelLoop]);

  const stop = useCallback(() => {
    cancelLoop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
    setScanning(false);
    setCameraIssue(null);
    setIssueOpen(false);
    writeStored(userId, false);
  }, [cancelLoop, userId]);

  // Kamera uzildi yoki tasvir qotdi: skan to'xtaydi (miltillash o'chadi), lekin
  // "yoqilgan" belgisi saqlanadi — kamera qaytsa o'zi davom etadi.
  const markLost = useCallback(() => {
    if (!streamRef.current) return;
    cancelLoop();
    streamRef.current.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
    setScanning(false);
    setCameraError(t("attendance.camera_lost_text"));
    setCameraIssue("lost");
    setIssueOpen(true);
    scanSound.attention();
  }, [t, cancelLoop]);

  const submit = useCallback(
    async (token, groupId, via = "camera") => {
      busyRef.current = true;
      try {
        // Yuz orqali: `token` o'rnida o'quvchi id (qolgani QR bilan bir xil oqim).
        const res =
          via === "face"
            ? await api.post("/attendance/face/scan", { studentId: token, groupId })
            : await api.post("/attendance/qr/scan", { token, groupId });
        const { ok, data, msg } = res.data;
        if (!ok) throw new Error(msg);

        if (data.needsGroup) {
          scanSound.attention();
          setGroupChoice({ token, via, ...data });
          return;
        }

        const item = { ...data, via, at: Date.now() };
        setResult(item);
        setHistory((prev) => [item, ...prev].slice(0, HISTORY_LIMIT));
        if (data.duplicate) scanSound.duplicate();
        else if (data.late) scanSound.late();
        else scanSound.success();

        // Alohida sahifa ko'rinmasligi mumkin — o'quvchi ISMI toast ichida.
        const name = data.student?.fullName || "";
        if (data.duplicate) toast.warning(name, { description: t("attendance.alreadyMarked") });
        else toast.success(name, { description: data.late ? t("attendance.markedLate") : t("attendance.marked") });
      } catch (error) {
        scanSound.error();
        errorMsg(error.message);
        const failed = { failed: true, message: error.message, via, at: Date.now() };
        setResult(failed);
        setHistory((prev) => [failed, ...prev].slice(0, HISTORY_LIMIT));
      } finally {
        busyRef.current = false;
      }
    },
    [t],
  );

  // Har kadrni canvas'ga chizib jsQR bilan o'qiydi; so'rov ketayotganda
  // (busyRef) yangi o'qish boshlanmaydi. Sikl o'zini ref orqali chaqiradi.
  const tick = useCallback(() => {
    const video = engineVideoRef.current;
    const canvas = canvasRef.current;

    const nowTs = Date.now();
    if (video && video.readyState === video.HAVE_ENOUGH_DATA && canvas && !busyRef.current && nowTs - qrAtRef.current >= QR_INTERVAL) {
      qrAtRef.current = nowTs;
      const scale = Math.min(1, QR_MAX_SIZE / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(image.data, image.width, image.height);

      if (code?.data) {
        const now = Date.now();
        const last = lastTokenRef.current;
        if (!(last.token === code.data && now - last.at < RESCAN_COOLDOWN)) {
          lastTokenRef.current = { token: code.data, at: now };
          submit(code.data);
        }
      }
    }

    // QR topilmasa — yuzni tekshirish (og'ir, shuning uchun FACE_INTERVAL bilan).
    const f = faceRef.current;
    if (faceOn && face.status === "ready" && video && !busyRef.current && !f.running && Date.now() - f.at >= (f.idle ? FACE_IDLE_INTERVAL : FACE_INTERVAL)) {
      f.running = true;
      f.at = Date.now();
      faceDetectRef.current(video)
        .then((hit) => {
          f.idle = !hit;
          if (!hit?.matched) {
            f.candidate = "";
            f.hits = 0;
            return;
          }
          f.hits = f.candidate === hit.studentId ? f.hits + 1 : 1;
          f.candidate = hit.studentId;
          if (f.hits < FACE_CONFIRM_FRAMES) return;
          f.hits = 0;
          const now = Date.now();
          if (now - (f.cooldown[hit.studentId] || 0) < FACE_COOLDOWN) return;
          f.cooldown[hit.studentId] = now;
          return submit(hit.studentId, undefined, "face");
        })
        .catch(() => {})
        .finally(() => {
          f.running = false;
        });
    }

    scheduleLoop();
  }, [submit, faceOn, face.status, scheduleLoop]);

  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  // `silent` — sahifa yangilanganda avto-yoqish: xato bo'lsa modal chiqmaydi.
  const start = useCallback(
    async ({ silent = false } = {}) => {
      if (streamRef.current) return;
      setCameraError("");
      const fail = (issue) => {
        setCameraError(t(`attendance.camera_${issue}_text`));
        writeStored(userId, false);
        if (!silent) {
          setCameraIssue(issue);
          setIssueOpen(true);
        }
      };
      try {
        if (!navigator.mediaDevices?.getUserMedia) return fail("missing");
        const list = await navigator.mediaDevices.enumerateDevices().catch(() => null);
        if (list && !list.some((d) => d.kind === "videoinput")) return fail("missing");

        const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        streamRef.current = media;
        // Kabel sug'urilsa yoki tizim kamerani olib qo'ysa trek tugaydi.
        media.getVideoTracks().forEach((track) => {
          track.onended = markLost;
        });
        if (engineVideoRef.current) {
          engineVideoRef.current.srcObject = media;
          await engineVideoRef.current.play();
        }
        setStream(media);
        setPreviewOpen(true);
        setCameraIssue(null);
        setIssueOpen(false);
        setScanning(true);
        writeStored(userId, true);
        scheduleLoop();
      } catch (error) {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        const name = error?.name;
        if (name === "NotAllowedError" || name === "SecurityError") fail("denied");
        else if (name === "NotReadableError" || name === "AbortError") fail("busy");
        else fail("missing");
      }
    },
    [t, markLost, scheduleLoop, userId],
  );

  // Tasvir qotganini aniqlash: trek "live" bo'lsa ham video vaqti yurmasa
  // (kabel yarim uzilgan, drayver qotgan) kamera uzilgan deb hisoblanadi.
  useEffect(() => {
    if (!scanning) return undefined;
    let last = -1;
    let still = 0;
    const timer = setInterval(() => {
      const video = engineVideoRef.current;
      // Fon tabda brauzer videoni to'xtatib qo'yadi — bu uzilish emas.
      if (!video || document.hidden) {
        still = 0;
        return;
      }
      const track = streamRef.current?.getVideoTracks()[0];
      if (!track || track.readyState === "ended") {
        markLost();
        return;
      }
      still = video.currentTime === last ? still + 1 : 0;
      last = video.currentTime;
      if (still >= FREEZE_TICKS) markLost();
    }, 1000);
    return () => clearInterval(timer);
  }, [scanning, markLost]);

  // Tab yashirin/ko'rinadigan bo'lganda sikl turini almashtiradi (aks holda
  // kutilayotgan rAF fonda hech qachon chaqirilmay sikl o'lib qolardi).
  useEffect(() => {
    if (!scanning) return undefined;
    document.addEventListener("visibilitychange", scheduleLoop);
    return () => document.removeEventListener("visibilitychange", scheduleLoop);
  }, [scanning, scheduleLoop]);

  // Kamera modali Escape bilan ham yopiladi (umumiy Dialog'ga tegmaymiz).
  useEffect(() => {
    if (!issueOpen) return undefined;
    const onKey = (e) => e.key === "Escape" && setIssueOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [issueOpen]);

  // Uzilgan kamera qayta ulansa — o'zi davom etadi (modal yopiladi).
  useEffect(() => {
    if (cameraIssue !== "lost" || !navigator.mediaDevices?.addEventListener) return undefined;
    const onChange = async () => {
      const list = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      if (list.some((d) => d.kind === "videoinput")) start({ silent: true });
    };
    navigator.mediaDevices.addEventListener("devicechange", onChange);
    return () => navigator.mediaDevices.removeEventListener("devicechange", onChange);
  }, [cameraIssue, start]);

  // Mavjudlik yo'qolsa (tarif/ruxsat/obuna) kamera darhol o'chadi; avval
  // yoqilgan bo'lsa sahifa yangilangandan keyin qayta yonadi.
  useEffect(() => {
    if (!available) {
      if (streamRef.current) stop();
      return;
    }
    if (isPhone || !readStored(userId)) return undefined;
    const timer = setTimeout(() => start({ silent: true }), 0);
    return () => clearTimeout(timer);
  }, [available, isPhone, start, stop, userId]);

  // Telefonda sahifadan chiqilsa kamera o'chadi.
  useEffect(() => {
    if (isPhone && pathname !== "/qr-attendance" && streamRef.current) stop();
  }, [isPhone, pathname, stop]);
  useEffect(() => () => {
    cancelLoop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, [cancelLoop]);

  // Apparat skaner: kamera yoqilmagan bo'lsa ham har doim tinglanadi.
  const onScannerToken = useCallback(
    (token) => {
      if (busyRef.current) return;
      const now = Date.now();
      const last = lastTokenRef.current;
      if (last.token === token && now - last.at < RESCAN_COOLDOWN) return;
      lastTokenRef.current = { token, at: now };
      setScannerSeen(true);
      submit(token, undefined, "scanner");
    },
    [submit],
  );
  useQrScanner(onScannerToken, available);

  const chooseGroup = async (groupId) => {
    const { token, via } = groupChoice;
    setGroupChoice(null);
    await submit(token, groupId, via);
  };

  const value = useMemo(
    () => ({
      available,
      isPhone,
      faceOn,
      face,
      scanning,
      stream,
      cameraError,
      cameraIssue,
      previewOpen,
      setPreviewOpen,
      result,
      history,
      scannerSeen,
      start,
      stop,
      canvasRef,
    }),
    [available, isPhone, faceOn, face, scanning, stream, cameraError, cameraIssue, previewOpen, result, history, scannerSeen, start, stop],
  );

  return (
    <ScannerContext.Provider value={value}>
      {children}
      {/* Skaner mexanizmi ko'radigan yashirin video/canvas — ekranda emas, lekin
          DOM'da (ba'zi brauzerlar ajratilgan videoni dekodlamaydi). */}
      {available && (
        <>
          <video ref={engineVideoRef} playsInline muted aria-hidden="true" className="fixed -left-[9999px] top-0 size-px" />
          <canvas ref={canvasRef} className="hidden" />
        </>
      )}
      <Dialog
        open={issueOpen && !!cameraIssue}
        onClose={() => setIssueOpen(false)}
        title={t(`attendance.camera_${cameraIssue || "missing"}_title`)}
        description={t(`attendance.camera_${cameraIssue || "missing"}_text`)}
        className="md:w-100"
        zIndex="z-40"
        actions={
          <>
            <Button color="black" variant="text" onClick={() => setIssueOpen(false)}>
              {t("common.close")}
            </Button>
            <Button
              onClick={() => {
                setIssueOpen(false);
                start();
              }}
            >
              {t("attendance.cameraRetry")}
            </Button>
          </>
        }
      >
        <div className="flex justify-center py-2">
          <span className="size-16 rounded-3xl flex items-center justify-center text-3xl bg-red-50 dark:bg-red-500/15 text-red-500 dark:text-red-400 ring-1 ring-red-200/70 dark:ring-red-500/30">
            <HiVideoCameraSlash />
          </span>
        </div>
      </Dialog>
      {/* O'quvchi bugun bir nechta guruhda darsga ega bo'lsa — qaysi biriga
          yozilishini so'raymiz. Modal ilova darajasida, istalgan sahifada chiqadi. */}
      <Dialog
        open={!!groupChoice}
        onClose={() => setGroupChoice(null)}
        title={t("attendance.chooseGroupTitle")}
        className="md:w-100"
        zIndex="z-40"
      >
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
          {t("attendance.chooseGroupHint", { name: groupChoice?.student?.fullName })}
        </p>
        <div className="flex flex-col gap-2">
          {groupChoice?.groups.map((g) => (
            <button
              key={g._id}
              onClick={() => chooseGroup(g._id)}
              className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-night-700 hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-500/15 cursor-pointer duration-200"
            >
              <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                {g.subject} - {g.activeId}
              </span>
              <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <HiClock className="text-slate-300 dark:text-slate-600" />
                {g.startTime} - {g.endTime}
              </span>
            </button>
          ))}
        </div>
      </Dialog>
    </ScannerContext.Provider>
  );
}
