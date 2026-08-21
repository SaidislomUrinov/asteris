import { useMemo } from "react";

const COLORS = {
  blue: { stroke: "#3b82f6", fill: "#3b82f6" },
  emerald: { stroke: "#10b981", fill: "#10b981" },
  amber: { stroke: "#f59e0b", fill: "#f59e0b" },
  red: { stroke: "#ef4444", fill: "#ef4444" },
  slate: { stroke: "#64748b", fill: "#64748b" },
};

const W = 300;
const H = 72;
const PAD = 4;

/**
 * Tashqi kutubxonasiz inline SVG sparkline.
 *
 * @param {string} title
 * @param {Array<number>} values
 * @param {string} [color] - "blue" | "emerald" | "amber" | "red" | "slate"
 * @param {string} [suffix] - qiymat birligi (ms, %, rps)
 * @param {boolean} [loading]
 * @param {string} [emptyText]
 * @param {(n:number)=>string} [format]
 */
export default function MetricsChart({
  title,
  values = [],
  color = "blue",
  suffix = "",
  loading = false,
  emptyText = "",
  format = (n) => String(Math.round(n * 100) / 100),
}) {
  const c = COLORS[color] || COLORS.blue;
  const gradId = `spark-${color}-${title.replace(/\W/g, "")}`;

  const { linePath, areaPath, min, max, last } = useMemo(() => {
    const nums = values.filter((v) => typeof v === "number" && !Number.isNaN(v));
    if (nums.length < 2) return {};

    const mn = Math.min(...nums);
    const mx = Math.max(...nums);
    const span = mx - mn || 1;
    const stepX = (W - PAD * 2) / (nums.length - 1);

    const pts = nums.map((v, i) => {
      const x = PAD + i * stepX;
      const y = H - PAD - ((v - mn) / span) * (H - PAD * 2);
      return `${Math.round(x * 100) / 100},${Math.round(y * 100) / 100}`;
    });

    return {
      linePath: `M ${pts.join(" L ")}`,
      areaPath: `M ${PAD},${H} L ${pts.join(" L ")} L ${W - PAD},${H} Z`,
      min: mn,
      max: mx,
      last: nums[nums.length - 1],
    };
  }, [values]);

  return (
    <div className="flex flex-col gap-2 bg-white border border-slate-200 rounded-xl p-4 w-full">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold text-slate-700 truncate">{title}</span>
        {last !== undefined && (
          <span className="text-[15px] font-semibold text-slate-800 whitespace-nowrap">
            {format(last)}
            <span className="text-[11px] text-slate-400 ml-0.5">{suffix}</span>
          </span>
        )}
      </div>

      {loading ? (
        <div className="w-full h-18 rounded-lg bg-slate-100 animate-pulse" />
      ) : !linePath ? (
        <div className="flex items-center justify-center w-full h-18 text-slate-400 text-[12px]">
          {emptyText}
        </div>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="w-full h-18"
            role="img"
            aria-label={title}
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c.fill} stopOpacity="0.28" />
                <stop offset="100%" stopColor={c.fill} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={areaPath} fill={`url(#${gradId})`} />
            <path
              d={linePath}
              fill="none"
              stroke={c.stroke}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>min {format(min)}{suffix}</span>
            <span>max {format(max)}{suffix}</span>
          </div>
        </>
      )}
    </div>
  );
}
