import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import socket from "../socket";
import { api } from "../utils/fetching";
import { HiGlobeAlt } from "react-icons/hi2";
import UpdateLang from "./UpdateLang";

const pathKeys = {
  "/dashboard": "nav.dashboard",
  "/leads": "nav.leads",
  "/leads/docs": "nav.leads",
  "/tariffs": "nav.tariffs",
  "/clients": "nav.clients",
};

export default function Top() {
  const { t } = useTranslation();
  const dp = useDispatch();
  const p = useLocation().pathname;
  const { _id } = useSelector((e) => e.user);
  const [socketStatus, setSocketStatus] = useState("reconnecting");

  const resolvedKey = pathKeys[p];

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
    online: "bg-emerald-500/20 text-emerald-300",
    reconnecting: "bg-yellow-500/20 text-yellow-300",
    offline: "bg-red-500/20 text-red-300",
  };

  const statusLabel = {
    online: t("socket.online"),
    reconnecting: t("socket.reconnecting"),
    offline: t("socket.offline"),
  };

  return (
    <div className="flex items-center justify-between w-full h-15 px-4 bg-slate-900">
      <div className="lg:hidden w-10" />

      <p className="font-semibold uppercase text-white text-[18px] lg:text-[28px]">
        {resolvedKey ? t(resolvedKey) : "ASTERIS"}
      </p>
      <div className="flex items-center gap-2">
        <UpdateLang />
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
