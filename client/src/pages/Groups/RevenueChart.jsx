import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiArrowTrendingDown, HiArrowTrendingUp, HiBanknotes } from "react-icons/hi2";
import { Area, CartesianGrid, ComposedChart, LabelList, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartCard from "../../ui/ChartCard";
import Checkbox from "../../ui/Checkbox";
import ChartHeader from "../../components/charts/ChartHeader";
import ChartTip from "../../components/charts/ChartTip";
import { buildMonthRevenue, currentMonthTashkent } from "../../components/charts/revenueSeries";
import { compact, money, useChartTheme, REVENUE_COLOR } from "../../components/charts/chartTheme";

const X_TICKS = [1, 5, 10, 15, 20, 25, 31];

// Grafik ichidagi qiymat yorlig'i — kichik "pill" (fon + chegara), chiziq
// ustida o'qilishi uchun. Kenglik matn uzunligidan taxminiy hisoblanadi.
function ValuePill({ x, y, text, fill, stroke, color, anchor = "end" }) {
  const w = text.length * 6.4 + 14;
  const left = anchor === "end" ? x - w : x;
  return (
    <g>
      <rect x={left} y={y - 10} width={w} height={20} rx={10} fill={fill} stroke={stroke} strokeWidth={1} />
      <text x={left + w / 2} y={y + 4} textAnchor="middle" fontSize={11} fontWeight={600} fill={color}>
        {text}
      </text>
    </g>
  );
}

/**
 * Oylik tushum (docs/API_CONTRACT_monthly_charts.md) — kalendar oyi bo'yicha
 * jamg'arma chizig'i, tepada katta jami summa, oxirgi kunda porlovchi sharcha.
 * `compare` berilsa "O'tgan oy" katakchasi chiqadi: o'tgan oy chizig'i, o'sish
 * foizi (o'tgan oyning AYNAN SHU KUNIGACHA bo'lgan summasiga nisbatan) va
 * o'sha kundagi nuqta. Oy — qaysi oy uchun to'langani (`forMonth`).
 *
 * @param {Object} props
 * @param {Array<{date:number, amount:number, status?:string}>} props.payments
 * @param {string} [props.month] - "YYYY-MM", berilmasa joriy oy
 * @param {boolean} [props.compare] - "O'tgan oy" katakchasi ko'rsatilsinmi
 */
function RevenueChart({ payments = [], month, compare = false }) {
  const { t } = useTranslation();
  const th = useChartTheme();
  const [showPrev, setShowPrev] = useState(false);
  const series = useMemo(() => buildMonthRevenue(payments, month || currentMonthTashkent()), [payments, month]);

  const monthNames = t("common.monthNames", { returnObjects: true });
  const nameOf = (m) => monthNames[Number(m.slice(5, 7)) - 1] || m;
  const curName = nameOf(series.month);
  const prevName = nameOf(series.prevMonth);
  const som = t("student.somSuffix");
  const fmt = (v) => compact(v, t);
  const withPrev = compare && showPrev;
  const up = (series.delta ?? 0) >= 0;

  // Bugungi (yoki oy oxiridagi) nuqta — "porlaydi": halo + tarqaluvchi
  // to'lqin. Harakatni kamaytirish yoqilgan bo'lsa to'lqin to'xtaydi.
  const endLabel = ({ x, y, index, value }) =>
    index === series.lastIndex && value != null ? (
      <g>
        <circle cx={x} cy={y} r={11} fill={REVENUE_COLOR} opacity={0.2} style={{ filter: "blur(3px)" }} />
        <circle
          cx={x}
          cy={y}
          r={6}
          fill={REVENUE_COLOR}
          opacity={0.45}
          className="animate-ping motion-reduce:animate-none"
          style={{ transformBox: "fill-box", transformOrigin: "center", animationDuration: "1.8s" }}
        />
        <circle
          cx={x}
          cy={y}
          r={5.5}
          fill={REVENUE_COLOR}
          stroke={th.surface}
          strokeWidth={2.5}
          style={{ filter: `drop-shadow(0 0 6px ${REVENUE_COLOR})` }}
        />
        {value > 0 && (
        <ValuePill
          x={x - 12}
          y={y - 18}
          text={fmt(value)}
          fill={th.isDark ? "#064e3b" : "#ecfdf5"}
          stroke={th.isDark ? "#065f46" : "#a7f3d0"}
          color={th.isDark ? "#a7f3d0" : "#047857"}
        />
        )}
      </g>
    ) : null;

  // O'tgan oy chizig'ida AYNAN SHU KUNdagi nuqta — bu oyning sharchasi bilan
  // bir vertikalda, solishtirish oson. Porlamaydi (urg'u bu oyda).
  const prevSameDayLabel = ({ x, y, index, value }) =>
    index === series.lastIndex && value != null ? (
      <g>
        <circle cx={x} cy={y} r={4.5} fill={th.axis} stroke={th.surface} strokeWidth={2} />
        <ValuePill
          x={x + 10}
          y={y + 18}
          anchor="start"
          text={fmt(value)}
          fill={th.surface}
          stroke={th.isDark ? "#2b3d66" : "#e2e8f0"}
          color={th.axis}
        />
      </g>
    ) : null;

  return (
    <ChartCard className="min-h-0">
      <ChartHeader
        icon={<HiBanknotes />}
        tone="emerald"
        title={t("chart.revenueTitle", { month: curName })}
        subtitle={series.upto ? t("chart.range", { month: curName, day: series.upto }) : undefined}
        right={
          compare && (
            // Bosiladigan joy aniq ko'rinsin — katakcha kichik pill ichida.
            <div
              className={`shrink-0 h-8 pl-2.5 pr-3 flex items-center rounded-full border transition-colors ${
                showPrev
                  ? "border-blue-200 dark:border-blue-500/30 bg-blue-50/70 dark:bg-blue-500/10"
                  : "border-slate-200 dark:border-night-700 hover:border-slate-300 dark:hover:border-night-600"
              }`}
            >
              <Checkbox
                variant="square"
                className="whitespace-nowrap text-xs font-medium text-slate-600 dark:text-slate-300"
                checked={showPrev}
                onChange={setShowPrev}
                label={t("chart.previousMonth")}
              />
            </div>
          )
        }
      />

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2 shrink-0">
        <span className="font-space text-3xl sm:text-4xl font-bold tracking-tight leading-none text-slate-900 dark:text-slate-100">
          {money(series.total)}
          <span className="ml-1.5 text-base font-medium tracking-normal text-slate-400 dark:text-slate-500">{som}</span>
        </span>
        {withPrev && (
          <>
            {series.delta != null && (
              <span
                title={t("chart.prevUntil", { month: prevName, day: series.upto, amount: `${money(series.prevSameDay)} ${som}` })}
                className={`self-center flex items-center gap-1 h-7 px-2.5 rounded-full text-sm font-semibold tabular-nums ${
                  up
                    ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                    : "bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-400"
                }`}
              >
                {up ? <HiArrowTrendingUp /> : <HiArrowTrendingDown />}
                {up ? "+" : "−"}
                {Math.abs(series.delta * 100).toFixed(1).replace(".", ",")}%
              </span>
            )}
            {/* 2 seriya — legend shart (rang yolg'iz identifikatsiya bo'lmasin). */}
            <span className="self-center flex items-center gap-3 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-[3px] rounded-full" style={{ background: REVENUE_COLOR }} />
                {curName}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-0.5 rounded-full" style={{ background: th.axis }} />
                {prevName}
              </span>
            </span>
          </>
        )}
      </div>

      <div className="flex-1 min-h-44 -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series.rows} margin={{ top: 28, right: 4, bottom: 0, left: 14 }}>
            <defs>
              <linearGradient id="monthRevenueWash" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={REVENUE_COLOR} stopOpacity={th.isDark ? 0.18 : 0.12} />
                <stop offset="100%" stopColor={REVENUE_COLOR} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={th.grid} />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tick={{ fill: th.axis, fontSize: 11 }}
              ticks={X_TICKS.filter((d) => d <= series.rows.length)}
            />
            <YAxis
              orientation="right"
              width={60}
              tickCount={5}
              // Bo'sh oy (hali to'lov yo'q) — shkala "0–4" kabi ma'nosiz
              // bo'lmasin: kamida 1 mln gacha.
              domain={[0, (max) => Math.max(max, 1_000_000)]}
              tickLine={false}
              axisLine={false}
              tick={{ fill: th.axis, fontSize: 11 }}
              tickFormatter={fmt}
            />
            <Tooltip
              cursor={{ stroke: th.cursor, strokeWidth: 1 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const cur = payload.find((p) => p.dataKey === "current")?.value;
                const prev = payload.find((p) => p.dataKey === "previous")?.value;
                const rows = [{ label: curName, value: cur != null ? `${money(cur)} ${som}` : "—", color: REVENUE_COLOR }];
                if (withPrev) {
                  rows.push({ label: prevName, value: prev != null ? `${money(prev)} ${som}` : "—", color: th.axis });
                  if (cur != null && prev != null) {
                    rows.push({ label: t("chart.diff"), value: `${cur - prev >= 0 ? "+" : "−"}${fmt(Math.abs(cur - prev))} ${som}` });
                  }
                }
                return <ChartTip title={t("chart.untilDay", { day: label })} rows={rows} />;
              }}
            />
            <Area
              type="monotone"
              dataKey="current"
              stroke="none"
              fill="url(#monthRevenueWash)"
              isAnimationActive={false}
              activeDot={false}
              tooltipType="none"
            />
            {withPrev && (
              <Line
                type="monotone"
                dataKey="previous"
                stroke={th.axis}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: th.axis, stroke: th.surface, strokeWidth: 2 }}
              >
                <LabelList dataKey="previous" content={prevSameDayLabel} />
              </Line>
            )}
            <Line
              type="monotone"
              dataKey="current"
              stroke={REVENUE_COLOR}
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={false}
              activeDot={{ r: 6, fill: REVENUE_COLOR, stroke: th.surface, strokeWidth: 2.5 }}
            >
              <LabelList dataKey="current" content={endLabel} />
            </Line>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export default RevenueChart;
