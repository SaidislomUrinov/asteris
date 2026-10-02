import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import UpdateLang from "./UpdateLang";
import NotificationBell from "./NotificationBell";
import KnowledgeBaseButton from "./knowledge/KnowledgeBaseButton";
import { resolveSectionTitleKey } from "../utils/navSections";

export default function Top() {
  const { t, i18n } = useTranslation();
  const p = useLocation().pathname;

  // Barcha bo'limlar (detail sahifalari ham) — utils/navSections.js.
  const resolvedKey = resolveSectionTitleKey(p);

  // Brauzer tab sarlavhasi ham joriy bo'lim va tilga mos bo'lishi uchun —
  // `resolvedKey` bilan bir xil manba, til almashsa `i18n.language`
  // o'zgarishi effektni qayta ishga tushiradi.
  useEffect(() => {
    document.title = resolvedKey ? `${t(resolvedKey)} · WENET` : "WENET";
  }, [resolvedKey, t, i18n.language]);

  return (
    // Fon — sidebar gradientining BOSHLANG'ICH rangi (`#0b2050`). Ikkalasi
    // bir balandlikda (h-15) yonma-yon turgani uchun shu rang ularni bitta
    // uzluksiz gorizontal lentaga birlashtiradi; neytral slate bo'lsa,
    // logotip yonida rang keskin sinib ko'rinardi.
    <div className="flex items-center justify-between w-full h-15 px-4 bg-[#0b2050] border-b border-white/7">
      <div className="lg:hidden w-10" />

      <div className="flex items-center gap-1.5 min-w-0">
        <p className="font-semibold font-space uppercase text-white text-[18px] lg:text-[28px] truncate">
          {resolvedKey ? t(resolvedKey) : "WENET"}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <KnowledgeBaseButton titleKey={resolvedKey} />
        <NotificationBell />
        <UpdateLang dark />
      </div>
    </div>
  );
}
