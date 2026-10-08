import { useTranslation } from "react-i18next";
import { HiBanknotes } from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Button from "../../ui/Button";
import Chip from "../../ui/Chip";
import useHideFinance from "../../hooks/useHideFinance";
import { maskMoney } from "../../utils/moneyFormat";
import { formatMonthName } from "./openingDebts.util";
import { formatCycleRange } from "./paymentMonth.util";

const formatMonthLabel = (month, monthNames) => formatMonthName(month, monthNames) || "—";

// Guruh entry'sining `debtBreakdown` (student.service.js "computeBilling")
// ro'yxatini oy-oy ko'rsatadi — faqat qarzi bor O'TGAN oylar (joriy oy
// alohida, kartochkada ko'rsatiladi). Har qatordagi "To'lov" bosilsa
// `onPayMonth(item)` chaqiriladi — parent shu ma'lumot bilan PaymentDialog'ni
// aynan shu oy uchun (summasi ham avtomatik) ochadi.
function DebtBreakdownDialog({ open, onClose, breakdown = [], onPayMonth }) {
  const { t } = useTranslation();
  const [hideFinance] = useHideFinance();
  const monthNames = t("common.monthNames", { returnObjects: true });
  const somSuffix = t("student.somSuffix");

  return (
    <Dialog open={open} onClose={onClose} title={t("student.debtBreakdownTitle")}>
      <div className="flex flex-col gap-2 w-full">
        {breakdown.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">{t("student.noDebt")}</p>
        ) : (
          // Tartib server bergandek (opening → sikllar), qayta sort qilinmaydi.
          breakdown.map((item, index) => (
            <div
              key={`${item.kind || "cycle"}-${item.month ?? "none"}-${index}`}
              className="flex flex-col gap-3 p-3 rounded-lg border border-slate-200 dark:border-night-700"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col min-w-0">
                  <span className="flex flex-wrap items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-100">
                    {item.kind === "opening" && (
                      <Chip value={t("student.openingBadge")} color="slate" className="!py-0.5 !px-1.5" />
                    )}
                    {item.kind === "opening" && !item.month
                      ? t("student.openingMonthUnknown")
                      : formatMonthLabel(item.month, monthNames)}
                    {/* Sikl oralig'i — bir oyda ikki qator bo'lsa ularni ajratadi */}
                    {item.kind !== "opening" && formatCycleRange(item.from, item.to) && (
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-night-800 rounded-md px-1.5 py-0.5 tabular-nums whitespace-nowrap">
                        {formatCycleRange(item.from, item.to)}
                      </span>
                    )}
                  </span>
                  {item.kind === "opening" && item.note && (
                    <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{item.note}</span>
                  )}
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {t("student.paidAmount")}: {maskMoney(item.paid, hideFinance)} /{" "}
                    {maskMoney(item.due, hideFinance)} {somSuffix}
                  </span>
                </div>
                <span className="font-semibold text-red-600 dark:text-red-400 shrink-0">
                  {maskMoney(item.debt, hideFinance)} {somSuffix}
                </span>
              </div>
              <Button
                color="emerald"
                className="gap-1.5 w-full"
                onClick={() => onPayMonth?.(item)}
              >
                <HiBanknotes className="text-base" />
                {t("student.addPayment")}
              </Button>
            </div>
          ))
        )}
      </div>
    </Dialog>
  );
}

export default DebtBreakdownDialog;
