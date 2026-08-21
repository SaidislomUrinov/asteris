import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { HiChartPie, HiLogout } from "react-icons/hi";
import {
  HiArrowTrendingUp,
  HiBanknotes,
  HiBars2,
  HiBookOpen,
  HiBuildingOffice2,
  HiCalendarDays,
  HiCreditCard,
  HiHome,
  HiPlayCircle,
  HiQrCode,
  HiReceiptPercent,
  HiUser,
  HiUserGroup,
  HiUsers,
  HiXMark,
} from "react-icons/hi2";
import MobileTabBar from "./MobileTabBar";
import { buildTabAvailability, resolveTabKeys } from "../utils/tabBar";
import { Link, useLocation } from "react-router-dom";
import useCan from "../hooks/useCan";
import useFeature from "../hooks/useFeature";
import { isSectionActive } from "../utils/navSections";

// `inTabBar` — bu bo'lim mobil pastki tab-bar'da ham bor. Unda mobil menyuda
// takrorlanmaydi (`hidden lg:flex`), desktopda esa odatdagidek qoladi.
const NavLink = ({ to, children, inTabBar = false }) => {
  const p = useLocation().pathname;
  const childrenArray = Array.isArray(children) ? children : [children];
  // Detail sahifasida ham ota bo'lim yonib turadi (`/groups/:id` -> Guruhlar).
  const isActive = isSectionActive(p, to);

  return (
    <Link
      className={`${inTabBar ? "hidden lg:flex" : "flex"} relative items-center duration-150 justify-start w-full px-3 min-h-11.25 max-h-11.25 rounded-xl overflow-hidden ${
        isActive ? "text-white" : "text-slate-400 hover:text-white"
      }`}
      to={to}
    >
      <span className="flex z-1 items-center justify-start w-full gap-5 duration-150 whitespace-nowrap">
        {childrenArray.map((child, index) => (
          <span
            key={`${to}-${index}`}
            className={index > 0 ? "" : "flex items-center justify-center"}
          >
            {child}
          </span>
        ))}
      </span>
      <span
        className={`h-full absolute animate-pulse left-0 duration-300 ${
          isActive ? "w-full" : "w-0"
        } rounded-xl bg-slate-700/60`}
      />
    </Link>
  );
};

export default function Navbar() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const p = useLocation().pathname;
  const { authType, role } = useSelector((e) => e.user);
  // O'qituvchi umumiy o'quvchilar ro'yxatini ko'rmaydi — u o'quvchilarni
  // FAQAT o'z guruhi ichida ko'radi (server ham guruhsiz so'rovni rad etadi).
  // O'qituvchi va yordamchi o'qituvchi umumiy o'quvchilar ro'yxatini
  // ko'rmaydi — o'quvchilarni FAQAT o'z guruhi ichida ko'radi.
  const isTeacher = authType === "staff" && ["teacher", "assistant"].includes(role);
  const can = useCan();
  const hasFeature = useFeature();

  // Mobil pastki tab-bar'da qaysi bo'limlar borligini bilib olamiz — ular
  // mobil menyuda takrorlanmaydi (desktopda hammasi ko'rinaveradi).
  const inTabBar = useMemo(() => {
    const keys = resolveTabKeys(authType, role, buildTabAvailability(authType, can));
    return Object.fromEntries(keys.map((k) => [k, true]));
  }, [authType, role, can]);

  useEffect(() => {
    setOpen(false);
  }, [p]);

  return (
    <>
      <div
        className={`flex z-3 items-start justify-start duration-300 w-62.5 h-screen bg-slate-900 border-r border-slate-800 flex-col fixed top-0 ${
          open ? "left-0" : "-left-62.5 lg:left-0"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between relative w-full h-15 px-4 border-b border-slate-800">
          <p className="text-[32px] font-space font-semibold text-white whitespace-nowrap">
            <span className="text-blue-400 font-space">A</span>steris
          </p>
          <div
            className={`absolute lg:hidden duration-300 ${open ? "right-4" : "-right-14"}`}
          >
            <button
              onClick={() => setOpen(!open)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              {open ? <HiXMark size={20} /> : <HiBars2 size={20} />}
            </button>
          </div>
        </div>

        {/* Links */}
        <div className="flex items-start justify-start w-full flex-col h-[calc(100vh-60px)] gap-1 overflow-y-auto p-3">
          <p className="text-slate-500 text-[12px] font-semibold uppercase tracking-wider whitespace-nowrap px-3 py-2">
            {t("nav.main")}
          </p>

          <NavLink to="/dashboard" inTabBar={inTabBar.dashboard}>
            <HiChartPie className="text-yellow-400 text-[20px]" />
            {t("nav.dashboard")}
          </NavLink>

          {authType === "owner" && (
            <NavLink to="/centers" inTabBar={inTabBar.centers}>
              <HiBuildingOffice2 className="text-blue-400 text-[20px]" />
              {t("nav.centers")}
            </NavLink>
          )}

          {authType === "owner" && (
            <NavLink to="/staff" inTabBar={inTabBar.staff}>
              <HiUsers className="text-violet-400 text-[20px]" />
              {t("nav.staff")}
            </NavLink>
          )}

          {can("subject:view") && (
            <NavLink to="/subjects">
              <HiBookOpen className="text-orange-400 text-[20px]" />
              {t("nav.subjects")}
            </NavLink>
          )}

          {can("room:view") && (
            <NavLink to="/rooms" inTabBar={inTabBar.rooms}>
              <HiHome className="text-teal-400 text-[20px]" />
              {t("nav.rooms")}
            </NavLink>
          )}

          {can("group:view") && (
            <NavLink to="/groups" inTabBar={inTabBar.groups}>
              <HiUserGroup className="text-pink-400 text-[20px]" />
              {t("nav.groups")}
            </NavLink>
          )}

          {can("group:update") && (
            <NavLink to="/schedule">
              <HiCalendarDays className="text-sky-400 text-[20px]" />
              {t("nav.schedule")}
            </NavLink>
          )}

          {isTeacher && (
            <NavLink to="/lesson" inTabBar={inTabBar.lesson}>
              <HiPlayCircle className="text-amber-400 text-[20px]" />
              {t("nav.lesson")}
            </NavLink>
          )}

          {can("student:view") && !isTeacher && (
            <NavLink to="/students" inTabBar={inTabBar.students}>
              <HiUsers className="text-cyan-400 text-[20px]" />
              {t("nav.students")}
            </NavLink>
          )}

          {can("attendance:create") && hasFeature("attendance.qr") && (
            <NavLink to="/qr-attendance">
              <HiQrCode className="text-indigo-400 text-[20px]" />
              {t("nav.qrAttendance")}
            </NavLink>
          )}

          <p className="text-slate-500 text-[12px] font-semibold uppercase tracking-wider whitespace-nowrap px-3 py-2 pt-3">
            {t("nav.other")}
          </p>

          <NavLink to="/salary" inTabBar={inTabBar.salary}>
            <HiBanknotes className="text-lime-500 text-[20px]" />
            {t("nav.salary")}
          </NavLink>

          {can("expense:view") && (
            <NavLink to="/expenses">
              <HiReceiptPercent className="text-rose-400 text-[20px]" />
              {t("nav.expenses")}
            </NavLink>
          )}

          {authType === "owner" && (
            <NavLink to="/revenue">
              <HiArrowTrendingUp className="text-emerald-400 text-[20px]" />
              {t("nav.revenue")}
            </NavLink>
          )}

          {authType === "owner" && (
            <NavLink to="/subscription">
              <HiCreditCard className="text-emerald-400 text-[20px]" />
              {t("nav.subscription")}
            </NavLink>
          )}

          {authType === "staff" && (
            <NavLink to="/profile" inTabBar={inTabBar.profile}>
              <HiUser className="text-sky-400 text-[20px]" />
              {t("nav.profile")}
            </NavLink>
          )}

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

      <MobileTabBar />
    </>
  );
}
