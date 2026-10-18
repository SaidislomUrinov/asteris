import { useTranslation } from "react-i18next";
import { HiChartPie } from "react-icons/hi2";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import ChartCard from "../../ui/ChartCard";
import ChartHeader from "../../components/charts/ChartHeader";
import ChartTip from "../../components/charts/ChartTip";
import { money, useChartTheme, PAID_COLOR, DEBT_COLOR } from "../../components/charts/chartTheme";

// To'lov holati (docs/API_CONTRACT_monthly_charts.md) — yarim doira
// o'lchagich: ko'k — to'langan, qizil — qarzdorlik; o'rtada katta foiz.
// Ikki seriya bo'lgani uchun legend shart. Hech qanday kutilgan to'lov
// bo'lmasa — faqat trek va "—".
function PaymentDonut({ paid = 0, debt = 0 }) {
  const { t } = useTranslation();
  const th = useChartTheme();
  const total = paid + debt;
  const ratio = total > 0 ? paid / total : null;
  const som = t("student.somSuffix");

  const data = total > 0
    ? [
        { key: "paid", name: t("group.paidLabel"), value: paid, color: PAID_COLOR },
        { key: "debt", name: t("group.debtLabel"), value: debt, color: DEBT_COLOR },
      ].filter((d) => d.value > 0)
    : [{ key: "empty", name: "", value: 1, color: th.track }];

  const rows = [
    { key: "paid", label: t("group.paidLabel"), value: paid, color: PAID_COLOR },
    { key: "debt", label: t("group.debtLabel"), value: debt, color: DEBT_COLOR },
  ];

  return (
    <ChartCard className="min-h-0">
      <ChartHeader icon={<HiChartPie />} tone="blue" title={t("group.paymentStatusTitle")} subtitle={t("chart.currentCycle")} />

      {/* Yoy katta va pastda — katta foiz uning bo'shlig'iga sig'adi. */}
      <div className="relative flex-1 min-h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            {total > 0 && (
              <Tooltip
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <ChartTip rows={[{ label: payload[0].name, value: `${money(payload[0].value)} ${som}`, color: payload[0].payload.color }]} />
                  ) : null
                }
              />
            )}
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cy="92%"
              innerRadius="150%"
              outerRadius="172%"
              startAngle={180}
              endAngle={0}
              cornerRadius={8}
              paddingAngle={data.length > 1 ? 2 : 0}
              stroke="none"
            >
              {data.map((d) => (
                <Cell key={d.key} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-x-0 bottom-[8%] flex flex-col items-center pointer-events-none">
          <span className="font-space text-5xl sm:text-6xl font-bold tracking-tight leading-none text-slate-900 dark:text-slate-100">
            {ratio == null ? "—" : `${Math.round(ratio * 100)}%`}
          </span>
          <span className="mt-1.5 text-xs font-medium text-slate-400 dark:text-slate-500">{t("chart.collected")}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-3 border-t border-slate-100 dark:border-night-700 shrink-0">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 min-w-0 text-slate-600 dark:text-slate-300">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
              <span className="truncate">{r.label}</span>
              {total > 0 && (
                <span className="text-xs text-slate-400 dark:text-slate-500">{Math.round((r.value / total) * 100)}%</span>
              )}
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-slate-800 dark:text-slate-100">
              {money(r.value)} <span className="text-xs font-normal text-slate-400">{som}</span>
            </span>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

export default PaymentDonut;
