import { useTranslation } from "react-i18next";
import { HiMiniUser } from "react-icons/hi2";

/**
 * "O'qituvchi ulushi" belgisi (docs/API_CONTRACT_teacher_share_ui.md §2) —
 * individual o'quvchi va guruhdagi alohida foiz uchun yagona chip.
 * `percent` yo'q bo'lsa (masalan o'qituvchiga yashirin) faqat "Individual".
 *
 * @param {Object} props
 * @param {number|null} [props.percent]
 * @param {boolean} [props.individual]
 * @param {string} [props.title] - native tooltip; berilmasa avtomatik
 * @param {string} [props.className]
 */
function ShareChip({ percent, individual = false, title, className = "" }) {
  const { t } = useTranslation();
  const hasPercent = percent != null;
  const tip =
    title ||
    [individual && t("individual.badgeTitle"), hasPercent && t("teacherShare.chipTooltip", { p: percent })]
      .filter(Boolean)
      .join(" · ");

  return (
    <span
      title={tip}
      aria-label={tip}
      className={`inline-flex items-center justify-center gap-1 shrink-0 whitespace-nowrap align-middle px-1.5 h-[18px] rounded-md text-[10px] font-bold leading-none select-none cursor-help bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 ring-1 ring-inset ring-violet-200 dark:ring-violet-400/30 ${className}`}
    >
      {individual && <span>{t("individual.label")}</span>}
      {individual && hasPercent && <span className="text-violet-400 dark:text-violet-500">·</span>}
      {hasPercent && (
        <span className="inline-flex items-center gap-0.5">
          <HiMiniUser className="text-[11px]" />
          {percent}%
        </span>
      )}
    </span>
  );
}

export default ShareChip;
