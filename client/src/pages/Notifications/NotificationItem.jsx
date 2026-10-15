import {
  HiShoppingBag,
  HiCalendarDays,
  HiExclamationTriangle,
  HiInformationCircle,
} from "react-icons/hi2";

const tr = (t, value, data) => (value?.startsWith("notification.") ? t(value, data) : value);

const clockOf = (unix) =>
  unix ? new Date(unix * 1000).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" }) : "";

const dateOf = (unix) => (unix ? new Date(unix * 1000).toLocaleDateString("uz-UZ") : "");

// Bildirishnoma turiga qarab icon + rang — mavjud `type` qiymatlari
// ("lesson:reminder", "subscription:expiring", "subscription:expired")
// asosida, kelajakda yangi turlar qo'shilsa ham "default" holatga tushadi.
const iconOf = (type) => {
  if (type === "subscription:expired") return { Icon: HiExclamationTriangle, cls: "bg-red-50 dark:bg-red-500/15 text-red-500" };
  if (type === "subscription:expiring") return { Icon: HiExclamationTriangle, cls: "bg-amber-50 dark:bg-amber-500/15 text-amber-500" };
  if (type === "shop:order") return { Icon: HiShoppingBag, cls: "bg-amber-50 dark:bg-amber-500/15 text-amber-500" };
  if (type === "lesson:reminder") return { Icon: HiCalendarDays, cls: "bg-blue-50 dark:bg-blue-500/15 text-blue-500" };
  return { Icon: HiInformationCircle, cls: "bg-slate-100 dark:bg-night-800 text-slate-400 dark:text-slate-500" };
};

/**
 * Bitta bildirishnoma qatori. Card emas — divide-y ro'yxat ichidagi qator,
 * lekin har biri o'z icon/type indikatoriga ega.
 */
function NotificationItem({ item, t, onOpen }) {
  const { Icon, cls } = iconOf(item.type);

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      aria-label={tr(t, item.title, item.data)}
      className={`flex items-start gap-3 py-3 text-left cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-night-800 focus-visible:bg-slate-50 dark:focus-visible:bg-night-800 focus-visible:outline-none -mx-2 px-2 rounded-lg ${
        item.read ? "" : "bg-blue-50/40 dark:bg-blue-500/15"
      }`}
    >
      <span className={`flex items-center justify-center w-8 h-8 shrink-0 rounded-lg text-base ${cls}`}>
        <Icon />
      </span>
      <span className="flex flex-col min-w-0 flex-1">
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
            {tr(t, item.title, item.data)}
          </span>
          {!item.read && <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-blue-500" />}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400 break-words">{tr(t, item.body, item.data)}</span>
        <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums mt-0.5">
          {dateOf(item.createdAt)} · {clockOf(item.createdAt)}
        </span>
      </span>
    </button>
  );
}

export default NotificationItem;
