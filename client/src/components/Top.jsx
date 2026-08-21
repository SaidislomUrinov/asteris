import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import socket from "../socket";
import { HiGlobeAlt } from "react-icons/hi2";
import UpdateLang from "./UpdateLang";
import NotificationBell from "./NotificationBell";
import { resolveSectionTitleKey } from "../utils/navSections";

export default function Top() {
  const { t } = useTranslation();
  const p = useLocation().pathname;
  const { _id } = useSelector((e) => e.user);
  const [socketStatus, setSocketStatus] = useState("reconnecting");

  // Barcha bo'limlar (detail sahifalari ham) — utils/navSections.js.
  const resolvedKey = resolveSectionTitleKey(p);

  useEffect(() => {
    if (!_id) return;
    socket.auth = { token: localStorage.getItem("access") };
    if (!socket.connected) socket.connect();

    const onConn = () => setSocketStatus("online");
    const onDisc = () => setSocketStatus("offline");
    const onReconn = () => setSocketStatus("reconnecting");

    socket.on("connect", onConn);
    socket.on("disconnect", onDisc);
    socket.io.on("reconnect", onReconn);

    return () => {
      socket.off("connect", onConn);
      socket.off("disconnect", onDisc);
      socket.io.off("reconnect", onReconn);
    };
  }, [_id]);

  const statusStyle = {
    online: "bg-emerald-500/15 text-emerald-400",
    reconnecting: "bg-yellow-500/15 text-yellow-400",
    offline: "bg-red-500/15 text-red-400",
  };

  const statusLabel = {
    online: t("socket.online"),
    reconnecting: t("socket.reconnecting"),
    offline: t("socket.offline"),
  };

  return (
    <div className="flex items-center justify-between w-full h-15 px-4 bg-slate-900 border-b border-slate-800">
      <div className="lg:hidden w-10" />

      <p className="font-semibold font-space uppercase text-white text-[18px] lg:text-[28px]">
        {resolvedKey ? t(resolvedKey) : "ASTERIS"}
      </p>
      <div className="flex items-center gap-2">
        <NotificationBell />
        <UpdateLang dark />
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold ${statusStyle[socketStatus]}`}
        >
          <HiGlobeAlt size={14} />
          <span className="hidden lg:inline">{statusLabel[socketStatus]}</span>
        </div>
      </div>
    </div>
  );
}
