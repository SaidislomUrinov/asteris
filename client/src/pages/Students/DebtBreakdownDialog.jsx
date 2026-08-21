import { useTranslation } from "react-i18next";
import { HiBanknotes } from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Button from "../../ui/Button";

function formatMonthLabel(forMonth, monthNames) {
  if (!forMonth) return "—";
  const [year, month] = forMonth.split("-").map(Number);
  if (!year || !month) return forMonth;
  return `${monthNames[month - 1] || ""} ${year}`;
}

// Guruh entry'sining `debtBreakdown` (student.service.js "computeBilling")
// ro'yxatini oy-oy ko'rsatadi — faqat qarzi bor O'TGAN oylar (joriy oy
// alohida, kartochkada ko'rsatiladi). Har qatordagi "To'lov" bosilsa
// `onPayMonth(item)` chaqiriladi — parent shu ma'lumot bilan PaymentDialog'ni
// aynan shu oy uchun (summasi ham avtomatik) ochadi.
function DebtBreakdownDialog({ open, onClose, breakdown = [], onPayMonth }) {
  const { t } = useTranslation();
  const monthNames = t("common.monthNames", { returnObjects: true });
  const somSuffix = t("student.somSuffix");

  return (
    <Dialog open={open} onClose={onClose} title={t("student.debtBreakdownTitle")}>
      <div className="flex flex-col gap-2 w-full">
        {breakdown.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">{t("student.noDebt")}</p>
        ) : (
          breakdown.map((item) => (
            <div
              key={item.month}
              className="flex flex-col gap-3 p-3 rounded-lg border border-slate-200"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-800">
                    {formatMonthLabel(item.month, monthNames)}
                  </span>
                  <span className="text-xs text-slate-400">
                    {t("student.paidAmount")}: {item.paid.toLocaleString("uz-UZ")} /{" "}
                    {item.due.toLocaleString("uz-UZ")} {somSuffix}
                  </span>
                </div>
                <span className="font-semibold text-red-600 shrink-0">
                  {item.debt.toLocaleString("uz-UZ")} {somSuffix}
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
