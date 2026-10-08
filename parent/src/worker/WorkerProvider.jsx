import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WorkerCtx } from "./workerContext";
import { workerApi } from "./api";
import { useSocketConnection, useSocketEvents } from "./useSocket";
import { LIVE_DEBOUNCE_MS, LIVE_EVENTS, ROLE_COLORS } from "./constants";

// Client panelidagi useFeature bilan bir xil: production'da vaqtincha
// yopiq flaglar tarifda yoqilgan bo'lsa ham yopiq ko'rinadi.
const FORCE_DISABLED = ["ai.report", "ai.advice"];

export const WorkerProvider = ({ initial, children }) => {
  const [me, setMe] = useState(initial);
  // Owner tanlagan filial ("" = barcha filiallar). Staff — doim o'z filiali.
  const [centerId, setCenterId] = useState("");
  const [tick, setTick] = useState(0);
  const [unread, setUnread] = useState(0);
  // Markaziy amal oynasi: { type: "payment" | "attendance", payload }
  const [sheet, setSheet] = useState(null);
  // Sahifa darajasidagi Telegram BackButton amali (WorkerShell yozadi) —
  // BottomSheet yopilganda tugmani o'chirib yubormay, shunga qaytaradi.
  const pageBackRef = useRef(null);
  const connected = useSocketConnection();

  const reloadMe = useCallback(async () => {
    try {
      setMe(await workerApi.me());
    } catch {
      /* eski qiymat qoladi — keyingi eventda yana urinadi */
    }
  }, []);

  const loadUnread = useCallback(async () => {
    try {
      const d = await workerApi.unreadCount();
      setUnread(d?.unread || 0);
    } catch {
      /* badge ixtiyoriy */
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      reloadMe();
      loadUnread();
    }, 0);
    return () => clearTimeout(id);
  }, [reloadMe, loadUnread]);

  // Jonli yangilanish: ketma-ket kelgan eventlar bitta qayta yuklashga
  // birlashtiriladi (≈800ms debounce, §4).
  const timer = useRef(null);
  const bump = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setTick((n) => n + 1), LIVE_DEBOUNCE_MS);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  useSocketEvents(LIVE_EVENTS, (ev) => {
    if (ev === "subscription:updated") reloadMe();
    bump();
  });
  useSocketEvents(["notification:new", "notification:unread"], (ev, payload) => {
    if (ev === "notification:unread" && typeof payload?.unread === "number") setUnread(payload.unread);
    else if (ev === "notification:new") setUnread((n) => n + 1);
  });

  // Qayta ulanganda o'tkazib yuborilgan eventlar o'rniga bir marta yangilash.
  const everConnected = useRef(false);
  useEffect(() => {
    if (!connected) return;
    if (everConnected.current) bump();
    everConnected.current = true;
  }, [connected, bump]);

  const value = useMemo(() => {
    const permissions = me?.permissions || [];
    const features = me?.features || {};
    const can = (perm) => !perm || permissions.includes("all") || permissions.includes(perm);
    const hasFeature = (key) => !key || (!FORCE_DISABLED.includes(key) && !!features[key]);
    const role = me?.role || (me?.kind === "owner" ? "owner" : "teacher");
    return {
      me,
      setMe,
      reloadMe,
      role,
      roleColor: ROLE_COLORS[role] || ROLE_COLORS.owner,
      isOwner: me?.kind === "owner",
      can,
      hasFeature,
      readOnly: !!me?.readOnly,
      centerId: me?.kind === "owner" ? centerId : me?.center?._id || "",
      setCenterId,
      tick,
      refresh: bump,
      unread,
      setUnread,
      connected,
      sheet,
      pageBackRef,
      openSheet: (type, payload = null) => setSheet({ type, payload }),
      closeSheet: () => setSheet(null),
    };
  }, [me, reloadMe, centerId, tick, bump, unread, connected, sheet]);

  return <WorkerCtx.Provider value={value}>{children}</WorkerCtx.Provider>;
};
