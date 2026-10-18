import { useTranslation } from "react-i18next";
import { HiReceiptPercent } from "react-icons/hi2";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import ChartHeader from "../charts/ChartHeader";
import ChartTip from "../charts/ChartTip";
import { compact, money } from "../charts/chartTheme";

const CATEGORY_COLORS = {
  rent: "#3b82f6",
  utilities: "#f59e0b",
  equipment: "#8b5cf6",
  marketing: "#ec4899",
  repair: "#f97316",
  other: "#64748b",
};

// Xarajatlar kategoriya bo'yicha — PaymentDonut bilan bir xil vizual naqsh
// (markazda jami summa, pastda rangli legend), lekin ko'p seriyali bo'lgani
// uchun legend shart (2 seriyali PaymentDonut'dan farqli).
function ExpenseCategoryDonut({ data = [] }) {
  const { t } = useTranslation();
  const total = data.reduce((sum, d) => sum + d.total, 0);
  const sorted = [...data].filter((d) => d.total > 0).sort((a, b) => b.total - a.total);

  const chartData = sorted.length ? sorted : [{ category: "other", total: 1 }];

  return (
    <div className="flex flex-col gap-3 p-5 rounded-xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 h-full min-h-0">
      <ChartHeader
        icon={<HiReceiptPercent />}
        tone="rose"
        title={t("center.expenseByCategoryTitle")}
        subtitle={t("center.expenseByCategoryDesc")}
      />

      <div className="relative w-full flex-1 min-h-28 max-h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            {sorted.length > 0 && (
              <Tooltip
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <ChartTip
                      rows={[
                        {
                          label: t(`expense.categories.${payload[0].payload.category}`),
                          value: `${money(payload[0].value)} ${t("student.somSuffix")}`,
                          color: CATEGORY_COLORS[payload[0].payload.category] || CATEGORY_COLORS.other,
                        },
                      ]}
                    />
                  ) : null
                }
              />
            )}
            <Pie
              data={chartData}
              dataKey="total"
              nameKey="category"
              innerRadius="80%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              paddingAngle={sorted.length > 1 ? 3 : 0}
              cornerRadius={6}
              stroke="none"
            >
              {chartData.map((entry) => (
                <Cell
                  key={entry.category}
                  fill={CATEGORY_COLORS[entry.category] || CATEGORY_COLORS.other}
                  opacity={sorted.length ? 1 : 0.15}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-10 text-center">
          <span className="text-xl font-space font-bold text-slate-900 dark:text-slate-100 leading-tight tabular-nums">
            {compact(total, t)}
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500">{t("student.somSuffix")}</span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 pt-3 border-t border-slate-100 dark:border-night-700 shrink-0 max-h-40 overflow-y-auto">
        {sorted.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-1">{t("expense.empty")}</p>
        ) : (
          sorted.map((d) => (
            <div key={d.category} className="flex items-center justify-between gap-2 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: CATEGORY_COLORS[d.category] || CATEGORY_COLORS.other }}
                />
                <span className="text-slate-600 dark:text-slate-300 truncate">{t(`expense.categories.${d.category}`)}</span>
              </div>
              <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100 shrink-0">
                {d.total.toLocaleString("uz-UZ")}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ExpenseCategoryDonut;
