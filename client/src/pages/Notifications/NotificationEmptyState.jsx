import { useTranslation } from "react-i18next";
import { HiBellSlash } from "react-icons/hi2";

/**
 * Bildirishnoma ro'yxati bo'sh bo'lganda ko'rsatiladigan compact holat
 * (butun ekranni egallamasin degan talab bilan — ~300px balandlik).
 */
function NotificationEmptyState() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center gap-2 h-[300px] text-center px-4">
      <span className="flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-50 text-2xl text-slate-300">
        <HiBellSlash />
      </span>
      <p className="text-sm font-medium text-slate-500">{t("notification.empty")}</p>
      <p className="text-xs text-slate-400 max-w-xs">{t("notification.emptySubtitle")}</p>
    </div>
  );
}

export default NotificationEmptyState;
