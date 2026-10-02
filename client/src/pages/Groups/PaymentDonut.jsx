import { useTranslation } from "react-i18next";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import ChartCard from "../../ui/ChartCard";

const PAID_COLOR = "#3b82f6"; // blue-500
const DEBT_COLOR = "#ef4444"; // red-500

// Joriy oy uchun to'lov holati — ikki qiymatli (to'langan/qarzdor) bo'lgani
// uchun donut markazida foiz + pastida rangli doira + summa bilan legend
// yetarli (dataviz: 2 seriyaga ham legend kerak, lekin bu yerda mark ustida
// to'g'ridan-to'g'ri label — number-heavy UI'da bu ustunroq).
function PaymentDonut({ paid = 0, debt = 0 }) {
  const { t } = useTranslation();
  const total = paid + debt;
  const percent = total > 0 ? Math.round((paid / total) * 100) : 100;

  const data =
    total > 0
      ? [
          { key: "paid", value: paid },
          { key: "debt", value: debt },
        ]
      : [{ key: "paid", value: 1 }];

  return (
    <ChartCard>
      <div className="shrink-0">
        <p className="font-semibold text-slate-800">{t("group.paymentStatusTitle")}</p>
        <p className="text-xs text-slate-400">{t("group.paymentStatusDesc")}</p>
      </div>

      <div className="relative w-full flex-1 min-h-32 max-h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="key"
              innerRadius="70%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              paddingAngle={total > 0 && paid > 0 && debt > 0 ? 3 : 0}
              cornerRadius={6}
              stroke="none"
            >
              {data.map((entry) => (
                <Cell
                  key={entry.key}
                  fill={entry.key === "paid" ? PAID_COLOR : DEBT_COLOR}
                  opacity={total === 0 ? 0.15 : 1}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-3xl font-space font-bold text-slate-800">{percent}%</span>
          <span className="text-xs text-slate-400">{t("group.paidPercentLabel")}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 shrink-0">
        <div className="flex items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PAID_COLOR }} />
            <span className="text-slate-600">{t("group.paidLabel")}</span>
          </div>
          <span className="font-semibold text-slate-800">
            {paid.toLocaleString("uz-UZ")} {t("student.somSuffix")}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: DEBT_COLOR }} />
            <span className="text-slate-600">{t("group.debtLabel")}</span>
          </div>
          <span className="font-semibold text-red-600">
            {debt.toLocaleString("uz-UZ")} {t("student.somSuffix")}
          </span>
        </div>
      </div>
    </ChartCard>
  );
}

export default PaymentDonut;
