import { useTranslation } from "react-i18next";
import { HiExclamationTriangle, HiMegaphone } from "react-icons/hi2";

/** Daraja belgisi: Muhim — amber, Juda muhim — qizil (API_CONTRACT_news.md §5). */
function NewsLevelChip({ level, size = "md", className = "" }) {
  const { t } = useTranslation();
  const critical = level === "critical";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-semibold ${
        size === "sm" ? "h-5 px-1.5 text-[10px]" : "h-6 px-2 text-[11px]"
      } ${
        critical ? "bg-red-50 text-red-600 ring-1 ring-red-100" : "bg-amber-50 text-amber-700 ring-1 ring-amber-100"
      } ${className}`}
    >
      {critical ? <HiExclamationTriangle className="text-[13px]" /> : <HiMegaphone className="text-[13px]" />}
      {t(critical ? "news.level.critical" : "news.level.important")}
    </span>
  );
}

export default NewsLevelChip;
