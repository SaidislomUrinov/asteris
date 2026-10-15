import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import UpdateLang from "./UpdateLang";
import NotificationBell from "./NotificationBell";
import HelpMenu from "./HelpMenu";
import ThemeToggle from "./ThemeToggle";
import HideFinanceToggle from "./HideFinanceToggle";
import CenterSwitcher from "./CenterSwitcher";
import TopMobileMenu from "./TopMobileMenu";
import useMediaQuery from "../hooks/useMediaQuery";
import useHideFinance from "../hooks/useHideFinance";
import { resolveSectionTitleKey } from "../utils/navSections";

export default function Top() {
  const { t, i18n } = useTranslation();
  const p = useLocation().pathname;

  // Barcha bo'limlar (detail sahifalari ham) — utils/navSections.js.
  const resolvedKey = resolveSectionTitleKey(p);
  const [hideFinance, toggleHideFinance] = useHideFinance();

  // Brauzer tab sarlavhasi ham joriy bo'lim va tilga mos bo'lishi uchun —
  // `resolvedKey` bilan bir xil manba, til almashsa `i18n.language`
  // o'zgarishi effektni qayta ishga tushiradi.
  useEffect(() => {
    document.title = resolvedKey ? `${t(resolvedKey)} · WENET` : "WENET";
  }, [resolvedKey, t, i18n.language]);

  const title = resolvedKey ? t(resolvedKey) : "WENET";
  // Telefonda: chap — hamburger (Navbar), markaz — sarlavha, o'ng — 4 kvadratli
  // menyu (filial, Qanday ishlaydi, Kun/Tun) + til + bildirishnoma. Faqat
  // bittasi render bo'ladi — chat obunasi ikki marta ochilmasin.
  const isPhone = useMediaQuery("(max-width: 639px)");

  if (isPhone) {
    return (
      <div className="flex items-center gap-2 w-full h-15 px-3 bg-[#0b2050] border-b border-white/7">
        <div className="w-10 shrink-0" />
        <div className="flex items-center justify-center gap-0.5 flex-1 min-w-0">
          <p
            className={`font-semibold font-space uppercase text-white text-[15px] leading-tight text-center ${
              title.includes(" ") ? "line-clamp-2" : "truncate"
            }`}
          >
            {title}
          </p>
          <HideFinanceToggle dark hidden={hideFinance} onToggle={toggleHideFinance} />
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <TopMobileMenu />
          <UpdateLang dark />
          <NotificationBell />
        </div>
      </div>
    );
  }

  return (
    // Fon — sidebar gradientining BOSHLANG'ICH rangi (`#0b2050`). Ikkalasi
    // bir balandlikda (h-15) yonma-yon turgani uchun shu rang ularni bitta
    // uzluksiz gorizontal lentaga birlashtiradi; neytral slate bo'lsa,
    // logotip yonida rang keskin sinib ko'rinardi.
    <div className="flex items-center justify-between w-full h-15 px-4 bg-[#0b2050] border-b border-white/7">
      <div className="lg:hidden w-10" />

      <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
        {/* Mobilda 5 ta ikonka yonida uzun nomlar kesilardi — kichikroq shrift,
            ko'p so'zli nom ("VIDEO QO'LLANMALAR") 2 qatorga o'raladi. Bitta so'z
            o'rtasidan bo'linmasin — u "…" bilan qisqaradi. */}
        <p
          className={`font-semibold font-space uppercase text-white text-[15px] leading-tight sm:text-[18px] sm:leading-normal lg:text-[28px] ${
            title.includes(" ") ? "line-clamp-2 sm:line-clamp-1" : "truncate"
          }`}
        >
          {title}
        </p>
        {/* Barcha sahifalarda — bitta umumiy holat (useHideFinance), sahifalar shu qiymat bilan niqoblaydi. */}
        <HideFinanceToggle dark hidden={hideFinance} onToggle={toggleHideFinance} />
      </div>
      <div className="flex items-center gap-0.5 sm:gap-2 shrink-0">
        <CenterSwitcher />
        <ThemeToggle />
        <HelpMenu />
        <NotificationBell />
        <UpdateLang dark />
      </div>
    </div>
  );
}
