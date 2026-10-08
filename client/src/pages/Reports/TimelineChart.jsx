import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiChartBar } from "react-icons/hi2";
import { money } from "./reportData";
import useTheme from "../../hooks/useTheme";

// Diagramma TASHQI KUTUBXONASIZ, sof SVG bilan chizilgan (docs/API_CONTRACT.md §2.3).
// Koordinatalar doim shu ichki tizimda hisoblanadi, `viewBox` esa uni
// konteyner kengligiga moslaydi — shuning uchun mobil/desktopda alohida
// o'lcham hisoblash kerak emas.
const VW = 1000;
const VH = 300;
const PAD = { top: 16, right: 12, bottom: 26, left: 52 };

const SERIES = [
  { key: "revenue", color: "#10b981", labelKey: "report.revenue" },
  { key: "expense", color: "#f97316", labelKey: "report.expense" },
  { key: "profit", color: "#3b82f6", labelKey: "report.profit" },
];

// O'q yorlig'i uchun qisqartma: 1 250 000 → "1.3M", 45 000 → "45K".
const shortNum = (v) => {
  const n = Math.abs(v);
  if (n >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(v / 1000)}K`;
  return String(Math.round(v));
};

function ChartSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-5 rounded-2xl bg-white dark:bg-night-900 border border-slate-200/80 dark:border-night-700/80">
      <div className="h-4 w-40 rounded bg-slate-100 dark:bg-night-800 animate-pulse" />
      <div className="w-full h-64 rounded-xl bg-slate-50 dark:bg-night-800 animate-pulse" />
    </div>
  );
}

/**
 * Tushum / xarajat / foyda dinamikasi.
 * `/api/reports/timeline` qatorlarini shundayligicha oladi.
 */
function TimelineChart({ rows = [], loading }) {
  const { t } = useTranslation();
  // SVG ranglari JS'da — `dark:` klassi ishlamaydi (kunduzgi qiymatlar avvalgidek).
  const { isDark } = useTheme();
  const GRID = isDark ? "#1e2e52" : "#e2e8f0";
  const AXIS = isDark ? "#2b3d66" : "#cbd5e1";
  const DOT_FILL = isDark ? "#0d1830" : "#fff";
  const wrapRef = useRef(null);
  const [hover, setHover] = useState(null);
  const [visible, setVisible] = useState(() => SERIES.map((s) => s.key));

  const geom = useMemo(() => {
    const n = rows.length;
    if (n === 0) return null;

    const innerW = VW - PAD.left - PAD.right;
    const innerH = VH - PAD.top - PAD.bottom;

    const values = rows.flatMap((r) => SERIES.map((s) => Number(r[s.key]) || 0));
    const rawMax = Math.max(...values, 0);
    const rawMin = Math.min(...values, 0);
    // Foyda manfiy bo'lishi mumkin — shkala nolni ham qamrab olishi shart,
    // aks holda chiziq maydondan chiqib ketadi.
    const max = rawMax === 0 && rawMin === 0 ? 1 : rawMax;
    const min = Math.min(rawMin, 0);
    const span = max - min || 1;

    // Bitta nuqta bo'lsa ham chiziq markazda ko'rinsin
    const x = (i) => PAD.left + (n === 1 ? innerW / 2 : (innerW * i) / (n - 1));
    const y = (v) => PAD.top + innerH - ((((Number(v) || 0) - min) / span) * innerH);

    const ticks = Array.from({ length: 5 }, (_, i) => min + (span * i) / 4);

    // X yorliqlari zichlashib ketmasin — ko'pi bilan 8 ta ko'rsatiladi
    const step = Math.max(1, Math.ceil(n / 8));

    return { n, x, y, ticks, step, zeroY: y(0), baseY: PAD.top + innerH };
  }, [rows]);

  if (loading) return <ChartSkeleton />;

  const hasData = rows.length > 0;

  const onMove = (e) => {
    if (!geom || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const vx = ratio * VW;
    const innerW = VW - PAD.left - PAD.right;
    const raw = geom.n === 1 ? 0 : ((vx - PAD.left) / innerW) * (geom.n - 1);
    const idx = Math.min(geom.n - 1, Math.max(0, Math.round(raw)));
    setHover({ idx, left: ratio * 100 });
  };

  const point = hover ? rows[hover.idx] : null;

  return (
    <div className="flex flex-col gap-3 p-5 rounded-2xl bg-white dark:bg-night-900 border border-slate-200/80 dark:border-night-700/80">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="font-semibold text-slate-800 dark:text-slate-100">{t("report.timelineTitle")}</p>

        {/* Seriyani yoqib/o'chirish — uchta chiziq bir vaqtda ko'p bo'lsa
            foydalanuvchi keraksizini o'chirib qo'yadi. */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {SERIES.map((s) => {
            const on = visible.includes(s.key);
            return (
              <button
                key={s.key}
                type="button"
                onClick={() =>
                  setVisible((prev) =>
                    prev.includes(s.key) ? prev.filter((k) => k !== s.key) : [...prev, s.key],
                  )
                }
                className={`inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-[13px] font-medium cursor-pointer transition-colors duration-150 ${
                  on ? "bg-slate-100 dark:bg-night-800 text-slate-700 dark:text-slate-300" : "text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-night-800"
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: on ? s.color : AXIS }}
                />
                {t(s.labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      {!hasData ? (
        <div className="flex flex-col items-center justify-center w-full h-64 gap-2 text-slate-400 dark:text-slate-500">
          <HiChartBar className="text-4xl" />
          <p className="text-sm">{t("report.timelineEmpty")}</p>
        </div>
      ) : (
        <div
          ref={wrapRef}
          className="relative w-full"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          {/* `preserveAspectRatio` standart ("meet") qoldirilgan — "none"
              bo'lganda matn cho'zilib o'qilmay qolardi. Balandlik kenglikka
              proporsional o'zgaradi, shuning uchun alohida o'lchov shart emas. */}
          <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full h-auto">
            <defs>
              {SERIES.map((s) => (
                <linearGradient key={s.key} id={`report-fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity="0.22" />
                  <stop offset="100%" stopColor={s.color} stopOpacity="0" />
                </linearGradient>
              ))}
            </defs>

            {/* Gorizontal to'r + qiymat o'qi */}
            {geom.ticks.map((v, i) => (
              <g key={i}>
                <line
                  x1={PAD.left}
                  x2={VW - PAD.right}
                  y1={geom.y(v)}
                  y2={geom.y(v)}
                  stroke={GRID}
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={PAD.left - 8}
                  y={geom.y(v) + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="#94a3b8"
                >
                  {shortNum(v)}
                </text>
              </g>
            ))}

            {/* Nol chizig'i — foyda manfiyga tushsa ko'rinadi */}
            {geom.zeroY < geom.baseY - 1 && (
              <line
                x1={PAD.left}
                x2={VW - PAD.right}
                y1={geom.zeroY}
                y2={geom.zeroY}
                stroke={AXIS}
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {SERIES.filter((s) => visible.includes(s.key)).map((s) => {
              const line = rows
                .map((r, i) => `${i === 0 ? "M" : "L"}${geom.x(i)},${geom.y(r[s.key])}`)
                .join(" ");
              const area = `${line} L${geom.x(geom.n - 1)},${geom.baseY} L${geom.x(0)},${geom.baseY} Z`;

              return (
                <g key={s.key}>
                  {/* To'ldirish faqat tushum/xarajat uchun ma'noli, foyda
                      manfiy bo'lishi mumkin — baribir bir xil chiziladi,
                      shaffofligi past bo'lgani uchun ustma-ust tushmaydi. */}
                  <path d={area} fill={`url(#report-fill-${s.key})`} />
                  <path
                    d={line}
                    fill="none"
                    stroke={s.color}
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  {hover && (
                    <circle
                      cx={geom.x(hover.idx)}
                      cy={geom.y(rows[hover.idx][s.key])}
                      r="4"
                      fill={DOT_FILL}
                      stroke={s.color}
                      strokeWidth="2"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                </g>
              );
            })}

            {hover && (
              <line
                x1={geom.x(hover.idx)}
                x2={geom.x(hover.idx)}
                y1={PAD.top}
                y2={geom.baseY}
                stroke="#94a3b8"
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {/* X o'qi yorliqlari */}
            {rows.map((r, i) =>
              i % geom.step === 0 || i === geom.n - 1 ? (
                <text
                  key={r.key || i}
                  x={geom.x(i)}
                  y={VH - 8}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#94a3b8"
                >
                  {r.label}
                </text>
              ) : null,
            )}
          </svg>

          {point && (
            <div
              className="pointer-events-none absolute top-2 z-1 flex flex-col gap-1 px-3 py-2 rounded-xl bg-white dark:bg-night-900 border border-slate-200 dark:border-night-700 shadow-lg dark:shadow-none text-xs"
              style={{
                left: `${Math.min(82, Math.max(2, hover.left))}%`,
              }}
            >
              <span className="font-semibold text-slate-700 dark:text-slate-300">{point.label}</span>
              {SERIES.filter((s) => visible.includes(s.key)).map((s) => (
                <span key={s.key} className="flex items-center gap-1.5 whitespace-nowrap">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-slate-400 dark:text-slate-500">{t(s.labelKey)}</span>
                  <span className="font-jet font-semibold text-slate-800 dark:text-slate-100">
                    {money(point[s.key])}
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TimelineChart;
