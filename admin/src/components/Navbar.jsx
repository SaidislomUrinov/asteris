import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiChartPie, HiLogout, HiUserGroup } from "react-icons/hi";
import {
  HiTag,
  HiUsers,
  HiClipboardDocumentList,
  HiChartBar,
  HiCog6Tooth,
} from "react-icons/hi2";
import { HiBars2, HiXMark } from "react-icons/hi2";
import { Link, useLocation } from "react-router-dom";

const NavLink = ({ to, children, startsWith }) => {
  const p = useLocation().pathname;
  const childrenArray = Array.isArray(children) ? children : [children];
  const isActive = startsWith ? p.startsWith(to) : p === to;

  return (
    <Link
      className={`flex relative items-center duration-150 justify-start w-full px-3 min-h-11.25 max-h-11.25 rounded-xl overflow-hidden ${
        isActive ? "text-white" : "text-white/50 hover:text-white"
      }`}
      to={to}
    >
      <span className="flex z-1 items-center justify-start w-full gap-5 duration-150 whitespace-nowrap">
        {childrenArray.map((child, index) => (
          <span
            key={index}
            className={index > 0 ? "" : "flex items-center justify-center"}
          >
            {child}
          </span>
        ))}
      </span>
      <span
        className={`h-full absolute animate-pulse left-0 duration-300 ${
          isActive ? "w-full" : "w-0"
        } rounded-xl bg-slate-700`}
      />
    </Link>
  );
};

export default function Navbar() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const p = useLocation().pathname;

  useEffect(() => {
    setOpen(false);
  }, [p]);

  return (
    <>
      <div
        className={`flex z-3 items-start justify-start duration-300 w-62.5 h-screen bg-slate-900 flex-col fixed top-0 ${
          open ? "left-0" : "-left-62.5 lg:left-0"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between relative w-full h-15 px-4 border-b border-slate-700">
          <p className="text-[32px] font-space font-semibold text-white whitespace-nowrap">
            <span className="text-emerald-500 font-space">A</span>steris
          </p>
          <div
            className={`absolute lg:hidden duration-300 ${open ? "right-4" : "-right-14"}`}
          >
            <button
              onClick={() => setOpen(!open)}
              className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-slate-700 transition-colors"
            >
              {open ? <HiXMark size={20} /> : <HiBars2 size={20} />}
            </button>
          </div>
        </div>

        {/* Links */}
        <div className="flex items-start justify-start w-full flex-col h-[calc(100vh-60px)] gap-1 overflow-y-auto p-3">
          <p className="text-zinc-500 text-[12px] font-semibold uppercase tracking-wider whitespace-nowrap px-3 py-2">
            {t("nav.main")}
          </p>

          <NavLink to="/dashboard">
            <HiChartPie className="text-yellow-400 text-[20px]" />
            {t("nav.dashboard")}
          </NavLink>

          <NavLink to="/leads" startsWith>
            <HiUserGroup className="text-cyan-400 text-[20px]" />
            {t("nav.leads")}
          </NavLink>

          <NavLink to="/clients" startsWith>
            <HiUsers className="text-violet-400 text-[20px]" />
            {t("nav.clients")}
          </NavLink>

          <NavLink to="/tariffs" startsWith>
            <HiTag className="text-emerald-400 text-[20px]" />
            {t("nav.tariffs")}
          </NavLink>

          {/* Platforma darajasidagi bo'limlar — kundalik ish bo'limlaridan
              ajratib turadi (audit, texnik holat, tizim konfiguratsiyasi). */}
          <p className="text-zinc-500 text-[12px] font-semibold uppercase tracking-wider whitespace-nowrap px-3 py-2 mt-2">
            {t("nav.system")}
          </p>

          <NavLink to="/audit-log" startsWith>
            <HiClipboardDocumentList className="text-amber-400 text-[20px]" />
            {t("nav.auditLog")}
          </NavLink>

          <NavLink to="/monitoring" startsWith>
            <HiChartBar className="text-sky-400 text-[20px]" />
            {t("nav.monitoring")}
          </NavLink>

          <NavLink to="/settings" startsWith>
            <HiCog6Tooth className="text-slate-400 text-[20px]" />
            {t("nav.systemSettings")}
          </NavLink>

          <NavLink to="#logout">
            <HiLogout className="text-red-400 text-[20px]" />
            {t("nav.logout")}
          </NavLink>
        </div>
      </div>

      {/* Mobile overlay */}
      <div
        className={`h-screen fixed backdrop-blur-sm top-0 left-0 z-2 duration-300 bg-slate-800/30 ${
          open ? "w-full" : "w-0"
        } cursor-pointer lg:hidden`}
        onClick={() => setOpen(false)}
      />
    </>
  );
}
