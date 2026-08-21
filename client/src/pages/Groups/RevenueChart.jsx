import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

const DAYS_BACK = 30;

function formatDay(unix) {
  const d = new Date(unix * 1000);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Tushum dinamikasi — so'nggi 30 kunda haqiqatda to'langan (status: "paid")
// to'lovlar summasi, kun bo'yicha guruhlanadi. Bitta seriya bo'lgani uchun
// legend shart emas (sarlavha seriyani ataydi).
function RevenueChart({ payments = [] }) {
  const { t } = useTranslation();

  const data = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayUnix = Math.floor(todayStart.getTime() / 1000);
    const dayLen = 24 * 60 * 60;

    const buckets = Array.from({ length: DAYS_BACK }, (_, i) => {
      const dayUnix = todayUnix - (DAYS_BACK - 1 - i) * dayLen;
      return { dayUnix, label: formatDay(dayUnix), amount: 0 };
    });
    const bucketIndex = Object.fromEntries(buckets.map((b, i) => [b.dayUnix, i]));

    payments
      .filter((p) => p.status === "paid")
      .forEach((p) => {
        const d = new Date(p.date * 1000);
        d.setHours(0, 0, 0, 0);
        const idx = bucketIndex[Math.floor(d.getTime() / 1000)];
        if (idx !== undefined) buckets[idx].amount += p.amount;
      });

    return buckets;
  }, [payments]);

  return (
    <div className="flex flex-col gap-3 p-5 rounded-xl border border-slate-200 bg-white h-full">
      <p className="font-semibold text-slate-800 shrink-0">{t("group.revenueChartTitle")}</p>

      <div className="w-full flex-1 min-h-44">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="0" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: "#e2e8f0" }}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <Tooltip
              cursor={{ stroke: "#10b981", strokeWidth: 1, strokeDasharray: "3 3" }}
              formatter={(value) => [
                `${Number(value).toLocaleString("uz-UZ")} ${t("student.somSuffix")}`,
                t("group.monthlyRevenue"),
              ]}
              contentStyle={{
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="amount"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#revenueFill)"
              dot={false}
              activeDot={{ r: 4, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default RevenueChart;
