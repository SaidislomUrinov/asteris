import { useTranslation } from "react-i18next";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi2";
import { fmtMonth, shiftMonth } from "../../utils/format";
import { tashkentMonth } from "../utils";

const ARROW = "w-9 h-9 rounded-full grid place-items-center text-hint active:opacity-70 disabled:opacity-30";

// Ixcham oy almashtirgich (‹ Oktabr 2026 ›). Kelajak oy yopiq — server
// `attendance.futureMonthNotAllowed` qaytaradi. `min` (ixtiyoriy) — undan
// oldingi oyga o'tib bo'lmaydi (O'quvchilar tabidagi oy filtri).
export const MonthSwitch = ({ month, onChange, min }) => {
  const { t } = useTranslation();
  const isCurrent = month >= tashkentMonth();
  const isFirst = !!min && month <= min;
  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        className={ARROW}
        disabled={isFirst}
        onClick={() => onChange(shiftMonth(month, -1))}
        aria-label={t("common.prevMonth")}
      >
        <HiChevronLeft className="w-5 h-5" />
      </button>
      <span className="font-title font-bold text-[15px]">{fmtMonth(month)}</span>
      <button
        type="button"
        className={ARROW}
        disabled={isCurrent}
        onClick={() => onChange(shiftMonth(month, 1))}
        aria-label={t("common.nextMonth")}
      >
        <HiChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
};
