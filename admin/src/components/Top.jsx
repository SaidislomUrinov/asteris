import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import UpdateLang from "./UpdateLang";

const pathKeys = {
  "/dashboard": "nav.dashboard",
  "/leads": "nav.leads",
  "/leads/docs": "nav.leads",
  "/tariffs": "nav.tariffs",
  "/clients": "nav.clients",
  "/audit-log": "nav.auditLog",
  "/monitoring": "nav.monitoring",
  "/logs": "nav.logs",
  "/settings": "nav.systemSettings",
  "/fonts": "nav.fonts",
  "/news": "nav.news",
  "/tutorial-videos": "nav.tutorialVideos",
  "/chat": "nav.chat",
};

// `/clients/:id` kabi detail sahifalar uchun ham eng yaqin mos prefiksni
// topadi — yangi route qo'shilganda shu yerga alohida qator qo'shish shart
// emas, faqat asosiy `/clients` kaliti bo'lsa yetarli.
const resolveTitleKey = (pathname) => {
  if (pathKeys[pathname]) return pathKeys[pathname];
  const match = Object.keys(pathKeys)
    .filter((p) => p !== "/" && pathname.startsWith(`${p}/`))
    .sort((a, b) => b.length - a.length)[0];
  return match ? pathKeys[match] : null;
};

export default function Top() {
  const { t } = useTranslation();
  const p = useLocation().pathname;

  const resolvedKey = resolveTitleKey(p);

  return (
    <div className="flex items-center justify-between w-full h-15 px-4 bg-slate-900">
      <div className="lg:hidden w-10" />

      <p className="font-semibold uppercase text-white text-[18px] lg:text-[28px]">
        {resolvedKey ? t(resolvedKey) : "WENET"}
      </p>
      <div className="flex items-center gap-2">
        <UpdateLang />
      </div>
    </div>
  );
}
