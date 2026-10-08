import { useTranslation } from "react-i18next";
// FaTelegram — hi/hi2 qoidasidan foydalanuvchi aniq so'ragan istisno (ui/TelegramBotLink.jsx).
import { FaTelegram } from "react-icons/fa";

/**
 * Guruh kartasidagi Telegram guruh holati belgisi. Ulangan — to'liq
 * Telegram rangida, ulanmagan — xira kulrang. Hover'da holat va (tahrirlash
 * huquqi bo'lsa) "Tahrirlash uchun bosing" tooltip'i chiqadi.
 *
 * Bosish karta bosilishiga (detalga o'tish) tarqalmaydi: tahrirlash huquqi
 * bo'lsa `onEdit` chaqiriladi, aks holda ulangan guruh havolasi ochiladi.
 *
 * @param {Object} props
 * @param {string|null} props.link
 * @param {boolean} [props.canEdit]
 * @param {() => void} [props.onEdit]
 */
function GroupTelegramBadge({ link, canEdit = false, onEdit }) {
  const { t } = useTranslation();
  const connected = !!link;
  const interactive = canEdit || connected;

  const onClick = (e) => {
    e.stopPropagation();
    if (canEdit) onEdit?.();
    else if (connected) window.open(link, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="relative group/tg shrink-0">
      <button
        type="button"
        onClick={onClick}
        disabled={!interactive}
        aria-label={connected ? t("group.telegramConnected") : t("group.telegramNotConnected")}
        className={`relative w-9 h-9 rounded-xl flex items-center justify-center text-[19px] transition-colors ${
          interactive ? "cursor-pointer" : "cursor-default"
        } ${
          connected
            ? "bg-[#229ED9]/10 text-[#229ED9] hover:bg-[#229ED9]/20"
            : "bg-slate-50 text-slate-300 ring-1 ring-inset ring-slate-200/80 hover:text-slate-400 dark:bg-night-800 dark:text-slate-600 dark:ring-night-700 dark:hover:text-slate-500"
        }`}
      >
        <FaTelegram aria-hidden="true" />
        <span
          className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-night-900 ${
            connected ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
          }`}
        />
      </button>

      {/* Tooltip — touch'da ko'rinmaydi, u yerda bosish to'g'ridan-to'g'ri oynani ochadi. */}
      <div
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full mt-2 z-10 w-max max-w-[220px] rounded-lg bg-slate-900 px-2.5 py-1.5 text-left opacity-0 transition-opacity duration-150 group-hover/tg:opacity-100"
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${connected ? "bg-emerald-400" : "bg-slate-400"}`}
          />
          {connected ? t("group.telegramConnected") : t("group.telegramNotConnected")}
        </span>
        {canEdit && (
          <span className="block mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
            {connected ? t("group.telegramClickToEdit") : t("group.telegramClickToConnect")}
          </span>
        )}
      </div>
    </div>
  );
}

export default GroupTelegramBadge;
