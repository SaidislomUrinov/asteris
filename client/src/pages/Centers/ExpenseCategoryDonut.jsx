import { useTranslation } from "react-i18next";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

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
    <div className="flex flex-col gap-3 p-5 rounded-xl border border-slate-200 bg-white h-full min-h-0">
      <div className="shrink-0">
        <p className="font-semibold text-slate-800">{t("center.expenseByCategoryTitle")}</p>
        <p className="text-xs text-slate-400">{t("center.expenseByCategoryDesc")}</p>
      </div>

      <div className="relative w-full flex-1 min-h-32 max-h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="total"
              nameKey="category"
              innerRadius="76%"
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
          <span className="text-[0.8rem] font-space font-bold text-slate-800 leading-tight tabular-nums">
            {total.toLocaleString("uz-UZ")}
          </span>
          <span className="text-[0.65rem] text-slate-400">{t("student.somSuffix")}</span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-100 shrink-0 max-h-32 overflow-y-auto">
        {sorted.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-1">{t("expense.empty")}</p>
        ) : (
          sorted.map((d) => (
            <div key={d.category} className="flex items-center justify-between gap-2 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: CATEGORY_COLORS[d.category] || CATEGORY_COLORS.other }}
                />
                <span className="text-slate-600 truncate">{t(`expense.categories.${d.category}`)}</span>
              </div>
              <span className="font-semibold text-slate-800 shrink-0">
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
