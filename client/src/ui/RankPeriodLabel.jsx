import { useTranslation } from "react-i18next";
import { HiTrophy } from "react-icons/hi2";
import { currentMonthTashkent, monthNameOf } from "../utils/badges";

/**
 * Reyting davri yozuvi — "Sentabr reytingi" (reyting endi JORIY OY bo'yicha,
 * docs/API_CONTRACT_badges_monthly_rank.md §A). `month` berilmasa joriy oy.
 */
function RankPeriodLabel({ month, className = "" }) {
  const { t } = useTranslation();
  const monthNames = t("common.monthNames", { returnObjects: true });
  const name = monthNameOf(month || currentMonthTashkent(), monthNames);
  if (!name) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 h-6 px-2 rounded-full bg-amber-50 text-[11px] font-semibold text-amber-700 whitespace-nowrap ${className}`}
    >
      <HiTrophy className="text-xs shrink-0" />
      {t("rank.monthLabel", { month: name })}
    </span>
  );
}

export default RankPeriodLabel;
