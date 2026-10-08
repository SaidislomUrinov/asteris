import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { HiLogout } from "react-icons/hi";
import { HiBars2, HiXMark } from "react-icons/hi2";
import MobileTabBar from "./MobileTabBar";
import SocketStatus from "./SocketStatus";
import { Link, useLocation } from "react-router-dom";
import { isSectionActive } from "../utils/navSections";
import useNavItems, { pickTabBarItems } from "../hooks/useNavItems";

// `inTabBar` — bu bo'lim mobil pastki tab-bar'da ham bor. Unda mobil menyuda
// takrorlanmaydi (`hidden lg:flex`), desktopda esa odatdagidek qoladi.
// `match` — bir nechta yo'lda aktiv bo'ladigan band (Sozlamalar).
const NavLink = ({ to, children, inTabBar = false, match = null }) => {
  const p = useLocation().pathname;
  const childrenArray = Array.isArray(children) ? children : [children];
  // Detail sahifasida ham ota bo'lim yonib turadi (`/groups/:id` -> Guruhlar).
  const isActive = (match || [to]).some((path) => isSectionActive(p, path));

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

export default function Navbar() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const p = useLocation().pathname;
  const { authType, role } = useSelector((e) => e.user);
  // Bandlar — hooks/useNavItems.js. Mobil pastki tab-bar'dagi bandlar mobil
  // menyuda takrorlanmaydi (desktopda hammasi ko'rinaveradi).
  const navItems = useNavItems();
  const tabKeys = new Set(pickTabBarItems(navItems, authType, role).map((item) => item.key));

  useEffect(() => {
    const id = setTimeout(() => setOpen(false), 0);
    return () => clearTimeout(id);
  }, [p]);

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

          {navItems.map((item) => (
            <NavLink key={item.key} to={item.to} match={item.match} inTabBar={tabKeys.has(item.key)}>
              <item.icon className="text-[20px]" />
              {t(item.labelKey)}
            </NavLink>
          ))}
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
