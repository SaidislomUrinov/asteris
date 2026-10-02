import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

const monthLabel = (m) => {
  const [, mm] = m.split("-");
  return mm;
};

function ClientGrowthChart({ data = [] }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3 p-5 rounded-xl border border-slate-200 bg-white h-full">
      <div className="flex flex-col gap-0.5">
        <p className="font-semibold text-slate-800">{t("dashboard.growthChartTitle")}</p>
        <p className="text-[12px] text-slate-400">{t("dashboard.growthChartSubtitle")}</p>
      </div>

      <div className="w-full flex-1 min-h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="0" />
            <XAxis
              dataKey="month"
              tickFormatter={monthLabel}
              tickLine={false}
              axisLine={{ stroke: "#e2e8f0" }}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
            />
            <Tooltip
              cursor={{ fill: "#f1f5f9" }}
              formatter={(value) => [value, t("dashboard.totalClients")]}
              contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
            />
            <Bar dataKey="count" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default ClientGrowthChart;
