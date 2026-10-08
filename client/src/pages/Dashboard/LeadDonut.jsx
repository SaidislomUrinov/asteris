import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { HiArrowRight } from "react-icons/hi2";

const STATUS_COLORS = {
  new: "#3b82f6",
  contacted: "#f59e0b",
  enrolled: "#10b981",
  rejected: "#94a3b8",
};
const ORDER = ["enrolled", "contacted", "new", "rejected"];

// Tanlangan oyda kelgan lidlar holat bo'yicha — ExpenseCategoryDonut bilan bir
// xil vizual naqsh. Markazda konversiya: nechta foizi guruhga o'tgan.
function LeadDonut({ stats }) {
  const { t } = useTranslation();
  const total = stats?.total || 0;
  const byStatus = stats?.byStatus || {};
  const rows = ORDER.map((key) => ({ key, count: byStatus[key] || 0 }));
  const filled = rows.filter((r) => r.count > 0);
  const chartData = filled.length ? filled : [{ key: "rejected", count: 1 }];
  const conversion = total ? Math.round(((byStatus.enrolled || 0) / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-3 p-5 rounded-xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 h-full min-h-0">
      <div className="flex items-start justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <p className="font-semibold text-slate-800 dark:text-slate-100">{t("lead.dashTitle")}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">{t("lead.dashDesc", { count: total })}</p>
        </div>
        <Link
          to="/leads"
          className="flex items-center gap-1 shrink-0 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-400"
        >
          {t("nav.leads")}
          <HiArrowRight />
        </Link>
      </div>

      <div className="relative w-full flex-1 min-h-32 max-h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="key"
              innerRadius="76%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              paddingAngle={filled.length > 1 ? 3 : 0}
              cornerRadius={6}
              stroke="none"
            >
              {chartData.map((entry) => (
                <Cell key={entry.key} fill={STATUS_COLORS[entry.key]} opacity={filled.length ? 1 : 0.2} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-10 text-center">
          <span className="text-xl font-space font-bold text-slate-800 dark:text-slate-100 leading-tight tabular-nums">
            {conversion}%
          </span>
          <span className="text-[0.65rem] text-slate-400 dark:text-slate-500">{t("lead.dashConversion")}</span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-100 dark:border-night-700 shrink-0">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between gap-2 text-sm min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[r.key] }} />
              <span className="text-slate-600 dark:text-slate-300 truncate">{t(`lead.status.${r.key}`)}</span>
            </div>
            <span className="font-semibold text-slate-800 dark:text-slate-100 shrink-0 tabular-nums">{r.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default LeadDonut;
