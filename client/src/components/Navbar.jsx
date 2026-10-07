import { Children, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { HiChartPie, HiLogout } from "react-icons/hi";
import {
  HiAcademicCap,
  HiArchiveBox,
  HiArrowTrendingUp,
  HiBanknotes,
  HiBars2,
  HiBookOpen,
  HiBuildingOffice2,
  HiCalendarDays,
  HiChartBar,
  HiPresentationChartLine,
  HiShieldCheck,
  HiChevronDown,
  HiCreditCard,
  HiHome,
  HiOutlineCalendarDays,
  HiPlayCircle,
  HiQrCode,
  HiReceiptPercent,
  HiRectangleStack,
  HiUser,
  HiViewfinderCircle,
  HiUserGroup,
  HiUsers,
  HiWallet,
  HiXMark,
} from "react-icons/hi2";
import MobileTabBar from "./MobileTabBar";
import SocketStatus from "./SocketStatus";
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
      className={`${inTabBar ? "hidden lg:flex" : "flex"} relative items-center duration-150 justify-start w-full px-3 min-h-11.25 max-h-11.25 rounded-xl ${
        isActive
          ? "bg-white/10 text-white"
          : "text-white/60 hover:text-white hover:bg-white/5"
      }`}
      to={to}
    >
      {/* Aktiv bo'limning chap chekkasidagi yorqin chiziq. Avval butun fon
          `animate-pulse` bilan tinmay lipillardi — bu holat ko'rsatkichi emas,
          shunchaki shovqin edi. Endi holatni qimirlamaydigan chiziq +
          shaffof fon bildiradi. */}
      {isActive && (
        <span className="absolute left-0 inset-y-2 w-0.75 rounded-r-full bg-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.9)]" />
      )}
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
    </Link>
  );
};

const GROUP_STORAGE_KEY = "wenet:nav:group";

// Bir vaqtda FAQAT bitta bo'lim ochiq turadi (akkordeon), shuning uchun holat
// bo'lim ichida emas — Navbar'da, bitta "ochiq bo'lim id'si" sifatida saqlanadi.
// Bo'limga tegishli sahifalar shu yerda sanaladi: joriy sahifa qaysi bo'limga
// tegishli ekanini ota komponent bilishi kerak (avtomatik ochish uchun).
const GROUP_ROUTES = {
  finance: ["/salary", "/expenses", "/revenue", "/finance", "/subscription"],
  other: ["/reports", "/reports/teacher-performance", "/audit-log", "/certificates", "/archive", "/profile"],
};

const readOpenGroup = () => {
  try {
    const saved = localStorage.getItem(GROUP_STORAGE_KEY);
    return saved && GROUP_ROUTES[saved] ? saved : null;
  } catch {
    return null;
  }
};

// Yig'iluvchi menyu bo'limi ("Moliya", "Boshqa"). Ruxsat/tarif filtrlaridan
// keyin bo'lim bo'sh qolsa — sarlavha ham chizilmaydi.
const NavGroup = ({ label, open, hasActive, onToggle, children }) => {
  const items = Children.toArray(children);
  if (!items.length) return null;

  // Mobil pastki tab-bar'da takrorlanadigan havolalar mobilda yashiriladi
  // (`inTabBar`). Bo'limda mobilda ko'rinadigan birorta havola qolmasa,
  // sarlavha ham ko'rsatilmaydi — aks holda bosilganda bo'sh joy ochilardi.
  const visibleOnMobile = items.some((child) => !child?.props?.inTabBar);

  return (
    <div className={`w-full ${visibleOnMobile ? "" : "hidden lg:block"}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`flex items-center justify-between w-full px-3 py-2 mt-2 rounded-xl duration-300 cursor-pointer ${
          open
            ? "text-white/80 bg-white/6"
            : "text-white/40 hover:text-white/70 hover:bg-white/4"
        }`}
      >
        <span className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider whitespace-nowrap">
          {label}
          {/* Bo'lim yopiq, lekin joriy sahifa ichida — nuqta buni bildiradi. */}
          {!open && hasActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
          )}
        </span>
        <HiChevronDown
          className={`text-[16px] shrink-0 duration-500 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Ochilish/yopilish `grid-template-rows: 0fr -> 1fr` orqali — balandlik
          oldindan o'lchanmasdan ham silliq animatsiya beradi. Ichki havolalar
          har doim DOM'da turadi, shuning uchun yopilish ham animatsiyalanadi. */}
      <div
        className={`grid transition-[grid-template-rows] duration-500 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="relative flex flex-col w-full gap-1 pt-1 pl-2.5">
            {/* Ichki havolalar ota bo'limga tegishli ekani chapdagi chiziq
                va chekinish orqali ko'rinadi. */}
            <span className="absolute left-0.5 top-1 bottom-1 w-px bg-white/10" />
            {items}
          </div>
        </div>
      </div>
    </div>
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
    const id = setTimeout(() => setOpen(false), 0);
    return () => clearTimeout(id);
  }, [p]);

  // Joriy sahifa qaysi yig'iluvchi bo'limga tegishli (yoki hech qaysiga).
  const activeGroup =
    Object.keys(GROUP_ROUTES).find((group) =>
      GROUP_ROUTES[group].some((route) => isSectionActive(p, route))
    ) || null;

  const [openGroup, setOpenGroup] = useState(readOpenGroup);

  // Joriy sahifa boshqa bo'limga O'TGAN paytdagina o'sha bo'limni ochamiz
  // (render paytida holatni moslash — effekt emas, aks holda `useEffect`
  // ichidagi setState lint qoidasini buzadi). Shu sahifada turib foydalanuvchi
  // bo'limni o'zi yopsa, qayta ochilib ketmaydi.
  const [prevActiveGroup, setPrevActiveGroup] = useState(activeGroup);
  if (activeGroup !== prevActiveGroup) {
    setPrevActiveGroup(activeGroup);
    if (activeGroup) setOpenGroup(activeGroup);
  }

  const toggleGroup = (id) => {
    setOpenGroup((prev) => {
      // Akkordeon: yangisi ochilganda avvalgisi o'z-o'zidan yopiladi.
      const next = prev === id ? null : id;
      try {
        if (next) localStorage.setItem(GROUP_STORAGE_KEY, next);
        else localStorage.removeItem(GROUP_STORAGE_KEY);
      } catch {
        // localStorage yopiq bo'lsa ham menyu ishlayveradi.
      }
      return next;
    });
  };

  return (
    <>
      <div
        data-intro="navbar"
        className={`flex z-3 items-start justify-start duration-300 w-62.5 h-screen bg-gradient-to-b from-[#0b2050] to-[#06122c] border-r border-white/7 flex-col fixed top-0 ${
          open ? "left-0" : "-left-62.5 lg:left-0"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between relative w-full h-15 px-4 border-b border-white/7">
          <p className="text-[32px] font-space font-semibold text-white whitespace-nowrap">
            <span className="text-blue-400 font-space">WE</span>NET
          </p>
          <div
            className={`absolute lg:hidden duration-300 ${open ? "right-4" : "-right-14"}`}
          >
            <button
              data-intro="navbar-toggle"
              onClick={() => setOpen(!open)}
              className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              {open ? <HiXMark size={20} /> : <HiBars2 size={20} />}
            </button>
          </div>
        </div>

        {/* Links */}
        {/* Sobit balandlik emas, `flex-1 min-h-0` — pastdagi Chiqish blokining
            balandligi hisobga olinishi va faqat shu ro'yxat scroll bo'lishi
            uchun (`min-h-0` bo'lmasa flex bola qisqarmay, overflow ishlamaydi). */}
        <div className="flex items-start justify-start w-full flex-col flex-1 min-h-0 gap-1 overflow-y-auto scrollbar-light p-3">
          {/* Realtime ulanish holati — "Asosiy" sarlavhasi tepasida. */}
          <SocketStatus />

          {/* Mobilda "Asosiy" bo'limining ko'p qismi pastki tab-bar'ga
              ko'chirilgan, shuning uchun sarlavha faqat katta ekranda
              ko'rsatiladi — mobil menyuda ortiqcha va tushunarsiz bo'lardi. */}
          <p className="hidden lg:block text-white/40 text-[12px] font-semibold uppercase tracking-wider whitespace-nowrap px-3 py-2">
            {t("nav.main")}
          </p>

          <NavLink to="/dashboard" inTabBar={inTabBar.dashboard}>
            <HiChartPie className="text-[20px]" />
            {t("nav.dashboard")}
          </NavLink>

          {can("lead:view") && !isTeacher && (
            <NavLink to="/leads">
              <HiViewfinderCircle className="text-[20px]" />
              {t("nav.leads")}
            </NavLink>
          )}

          {authType === "owner" && (
            <NavLink to="/centers" inTabBar={inTabBar.centers}>
              <HiBuildingOffice2 className="text-[20px]" />
              {t("nav.centers")}
            </NavLink>
          )}

          {authType === "owner" && (
            <NavLink to="/staff" inTabBar={inTabBar.staff}>
              <HiUsers className="text-[20px]" />
              {t("nav.staff")}
            </NavLink>
          )}

          {/* O'qituvchi/yordamchida Fanlar bo'limi yo'q — ruxsat (API) cheklanmaydi. */}
          {can("subject:view") && !isTeacher && (
            <NavLink to="/subjects">
              <HiBookOpen className="text-[20px]" />
              {t("nav.subjects")}
            </NavLink>
          )}

          {can("room:view") && hasFeature("room.control") && (
            <NavLink to="/rooms" inTabBar={inTabBar.rooms}>
              <HiHome className="text-[20px]" />
              {t("nav.rooms")}
            </NavLink>
          )}

          {can("group:view") && (
            <NavLink to="/groups" inTabBar={inTabBar.groups}>
              <HiUserGroup className="text-[20px]" />
              {t("nav.groups")}
            </NavLink>
          )}

          {/* Jadval — ommaviy drag-and-drop rejalashtiruvchi, backend uni
              O'qituvchi/Yordamchi uchun `group:update` bo'lsa ham qat'iy
              yopib qo'ygan (`blockTeachingRoles`, group.routes.js) — shuning
              uchun bu yerda ham rol bo'yicha yashiriladi. */}
          {can("group:update") && !isTeacher && (
            <NavLink to="/schedule">
              <HiCalendarDays className="text-[20px]" />
              {t("nav.schedule")}
            </NavLink>
          )}

          {isTeacher && (
            <NavLink to="/lesson" inTabBar={inTabBar.lesson}>
              <HiPlayCircle className="text-[20px]" />
              {t("nav.lesson")}
            </NavLink>
          )}

          {isTeacher && hasFeature("lesson.planning") && (
            <NavLink to="/my-plans">
              <HiRectangleStack className="text-[20px]" />
              {t("nav.myPlans")}
            </NavLink>
          )}

          {can("student:view") && !isTeacher && (
            <NavLink to="/students" inTabBar={inTabBar.students}>
              <HiUsers className="text-[20px]" />
              {t("nav.students")}
            </NavLink>
          )}


          {can("attendance:create") && hasFeature("attendance.qr") && (
            <NavLink to="/qr-attendance">
              <HiQrCode className="text-[20px]" />
              {t("nav.qrAttendance")}
            </NavLink>
          )}

          {can("calendar:view") && (
            <NavLink to="/calendar">
              <HiOutlineCalendarDays className="text-[20px]" />
              {t("nav.calendar")}
            </NavLink>
          )}

          {/* Moliya — pul bilan bog'liq bo'limlar (ish haqi, xarajat, tushum,
              hodim hamyoni, obuna). Yig'iluvchi: menyu juda uzayib ketmasligi
              uchun sarlavhaga bosilganda ochiladi/yopiladi. */}
          <NavGroup
            label={t("nav.financeSection")}
            open={openGroup === "finance"}
            hasActive={activeGroup === "finance"}
            onToggle={() => toggleGroup("finance")}
          >
            {can("salary:view") && (
              <NavLink to="/salary" inTabBar={inTabBar.salary}>
                <HiBanknotes className="text-[20px]" />
                {t("nav.salary")}
              </NavLink>
            )}

            {can("expense:view") && hasFeature("finance.expense") && (
              <NavLink to="/expenses">
                <HiReceiptPercent className="text-[20px]" />
                {t("nav.expenses")}
              </NavLink>
            )}

            {authType === "owner" && (
              <NavLink to="/revenue">
                <HiArrowTrendingUp className="text-[20px]" />
                {t("nav.revenue")}
              </NavLink>
            )}

            {authType === "staff" && (
              <NavLink to="/finance" inTabBar={inTabBar.finance}>
                <HiWallet className="text-[20px]" />
                {t("nav.finance")}
              </NavLink>
            )}

            {authType === "owner" && (
              <NavLink to="/subscription">
                <HiCreditCard className="text-[20px]" />
                {t("nav.subscription")}
              </NavLink>
            )}
          </NavGroup>

          <NavGroup
            label={t("nav.other")}
            open={openGroup === "other"}
            hasActive={activeGroup === "other"}
            onToggle={() => toggleGroup("other")}
          >
            {can("report:view") && (hasFeature("finance.report") || hasFeature("attendance.report")) && (
              <NavLink to="/reports">
                <HiPresentationChartLine className="text-[20px]" />
                {t("nav.reports")}
              </NavLink>
            )}

            {/* Samaradorlik moliyaviy hisobotli tarifda Hisobotlar ichida tab
                bo'lib turadi — alohida havola faqat undan tashqarida kerak. */}
            {can("report:view") && hasFeature("teacher.performance") && !hasFeature("finance.report") && (
              <NavLink to="/reports/teacher-performance">
                <HiChartBar className="text-[20px]" />
                {t("nav.teacherPerformance")}
              </NavLink>
            )}

            {can("certificate:view") && hasFeature("certificate.manage") && (
              <NavLink to="/certificates">
                <HiAcademicCap className="text-[20px]" />
                {t("nav.certificates")}
              </NavLink>
            )}

            {/* Arxiv — arxivlangan Guruh/O'quvchi/Hodim/Xona/Fan bitta joyda
                (API_CONTRACT_archive.md). Boshliqda har doim, hodimda faqat
                `archive:view` berilgan bo'lsa. */}
            {can("archive:view") && !isTeacher && (
              <NavLink to="/archive">
                <HiArchiveBox className="text-[20px]" />
                {t("nav.archive")}
              </NavLink>
            )}

            {authType === "owner" && (
              <NavLink to="/audit-log">
                <HiShieldCheck className="text-[20px]" />
                {t("nav.auditLog")}
              </NavLink>
            )}

            {(authType === "staff" || authType === "owner") && (
              <NavLink to="/profile" inTabBar={inTabBar.profile}>
                <HiUser className="text-[20px]" />
                {t("nav.profile")}
              </NavLink>
            )}
          </NavGroup>

        </div>

        {/* Chiqish — scroll qilinadigan ro'yxatdan TASHQARIDA, sidebar'ning
            sobit pastki qismi. Shu sababli bo'lim ochilib ro'yxat uzayganda
            ham u joyidan qimirlamaydi (ilgari ro'yxat ichida edi va ochilish
            animatsiyasi paytida pastga suriladi). */}
        <div className="flex flex-col w-full gap-1 shrink-0 p-3 border-t border-white/7">
          <NavLink to="#logout">
            <HiLogout className="text-[20px]" />
            {t("nav.logout")}
          </NavLink>
        </div>
      </div>

      <MobileTabBar />

      {/* Mobile overlay — sidebar ochilganda pastki tab-bar'ni ham
          bosib, bosilganda sidebar'ni yopadi. DOM tartibi ataylab
          `MobileTabBar`dan KEYIN: ikkalasi ham `z-2`, teng z-index'da
          keyingi element ustidan chiziladi — aks holda ochiq sidebar
          paytida tab-bar overlay'ning USTIDA qolib, uni yopmasdan
          bosib bo'lardi. */}
      <div
        className={`h-screen fixed backdrop-blur-sm top-0 left-0 z-2 duration-300 bg-slate-800/30 ${
          open ? "w-full" : "w-0"
        } cursor-pointer lg:hidden`}
        onClick={() => setOpen(false)}
      />
    </>
  );
}
