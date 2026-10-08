import { useTranslation } from "react-i18next";
import BadgeIcon from "./BadgeIcon";
import { BADGE_TYPES, badgeNameKey, formatBadgeMonth } from "../utils/badges";

/**
 * O'quvchi ismi yonidagi ixcham nishonlar qatori (guruh ro'yxatlari uchun):
 * ko'pi bilan `max` ta + "+N". Tooltip — "Nomi · Oy yil".
 *
 * @param {Object} props
 * @param {string[]} [props.types] — o'quvchining shu oydagi nishon turlari
 * @param {string|null} [props.month] — "YYYY-MM"
 * @param {number} [props.max=3]
 * @param {number} [props.size=18]
 */
function MiniBadges({ types, month, max = 3, size = 18 }) {
  const { t } = useTranslation();
  if (!types?.length) return null;

  const monthNames = t("common.monthNames", { returnObjects: true });
  const monthLabel = formatBadgeMonth(month, monthNames);
  // Server tartibidan qat'iy nazar BADGE_TYPES tartibida ko'rsatiladi.
  const ordered = BADGE_TYPES.filter((type) => types.includes(type));
  const shown = ordered.slice(0, max);
  const rest = ordered.slice(max);
  const titleOf = (type) => (monthLabel ? `${t(badgeNameKey(type))} · ${monthLabel}` : t(badgeNameKey(type)));

  return (
    <span className="inline-flex items-center gap-0.5 shrink-0">
      {shown.map((type) => (
        <BadgeIcon key={type} type={type} size={size} label={titleOf(type)} animated={false} />
      ))}
      {rest.length > 0 && (
        <span
          title={rest.map(titleOf).join("\n")}
          className="inline-flex items-center h-4 px-1 rounded-full bg-slate-100 dark:bg-night-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-none"
        >
          +{rest.length}
        </span>
      )}
    </span>
  );
}

export default MiniBadges;
