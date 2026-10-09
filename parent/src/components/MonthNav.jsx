import { useTranslation } from "react-i18next";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi2";
import { Card } from "./Card";
import { fmtMonth, shiftMonth } from "../utils/format";

// Oy navigatsiyasi (‹ Sentabr 2026 ›). Baholar va Vazifalar tablarida umumiy.
export const MonthNav = ({ month, onChange }) => {
  const { t } = useTranslation();
  return (
    <Card className="flex items-center justify-between py-2.5">
      <button type="button" onClick={() => onChange(shiftMonth(month, -1))} className="p-1.5 -m-1.5 text-hint" aria-label={t("common.prevMonth")}><HiChevronLeft className="w-5 h-5" /></button>
      <div className="font-title font-bold">{fmtMonth(month)}</div>
      <button type="button" onClick={() => onChange(shiftMonth(month, 1))} className="p-1.5 -m-1.5 text-hint" aria-label={t("common.nextMonth")}><HiChevronRight className="w-5 h-5" /></button>
    </Card>
  );
};
