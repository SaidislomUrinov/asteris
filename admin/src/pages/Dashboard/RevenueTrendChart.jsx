import { useTranslation } from "react-i18next";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

const monthLabel = (m) => {
  const [, mm] = m.split("-");
  return mm;
};

function RevenueTrendChart({ data = [] }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3 p-5 rounded-xl border border-slate-200 bg-white h-full">
      <div className="flex flex-col gap-0.5">
        <p className="font-semibold text-slate-800">{t("dashboard.revenueChartTitle")}</p>
        <p className="text-[12px] text-slate-400">{t("dashboard.revenueChartSubtitle")}</p>
      </div>

      <div className="w-full flex-1 min-h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="adminRevenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="0" />
            <XAxis
              dataKey="month"
              tickFormatter={monthLabel}
              tickLine={false}
              axisLine={{ stroke: "#e2e8f0" }}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
            />
            <Tooltip
              cursor={{ stroke: "#3b82f6", strokeWidth: 1, strokeDasharray: "3 3" }}
              formatter={(value) => [
                `${Number(value).toLocaleString("uz-UZ")} ${t("dashboard.somSuffix")}`,
                t("dashboard.currentMonthRevenue"),
              ]}
              labelFormatter={(label) => label}
              contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
            />
            <Area
              type="linear"
              dataKey="amount"
              stroke="#3b82f6"
              strokeWidth={3}
              fill="url(#adminRevenueFill)"
              dot={false}
              activeDot={{ r: 4, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default RevenueTrendChart;
