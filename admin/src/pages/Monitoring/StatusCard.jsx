const DOT = {
  healthy: "bg-emerald-500",
  ok: "bg-emerald-500",
  up: "bg-emerald-500",
  degraded: "bg-amber-500",
  slow: "bg-amber-500",
  down: "bg-red-500",
  error: "bg-red-500",
};

const RING = {
  healthy: "bg-emerald-500/30",
  ok: "bg-emerald-500/30",
  up: "bg-emerald-500/30",
  degraded: "bg-amber-500/30",
  slow: "bg-amber-500/30",
  down: "bg-red-500/30",
  error: "bg-red-500/30",
};

/**
 * Bitta xizmat holati kartasi (Mongo / Redis / Socket / Storage).
 *
 * @param {string} title - xizmat nomi
 * @param {string} status - "healthy" | "degraded" | "down"
 * @param {string} statusText - tarjima qilingan holat matni
 * @param {number} [latencyMs]
 * @param {Array<{label: string, value: React.ReactNode}>} [rows] - qo'shimcha ko'rsatkichlar
 * @param {React.ReactNode} [icon]
 */
export default function StatusCard({
  title,
  status = "down",
  statusText,
  latencyMs,
  latencyLabel,
  rows = [],
  icon = null,
}) {
  const dot = DOT[status] || "bg-slate-400";
  const ring = RING[status] || "bg-slate-400/30";

  return (
    <div className="flex flex-col gap-3 bg-white border border-slate-200 rounded-xl p-4 w-full">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="text-slate-400 text-lg shrink-0">{icon}</span>}
          <span className="font-semibold text-slate-800 truncate">{title}</span>
        </div>
        <span className="relative flex items-center justify-center w-3 h-3 shrink-0">
          <span className={`absolute inline-flex w-3 h-3 rounded-full ${ring}`} />
          <span className={`relative inline-flex w-2 h-2 rounded-full ${dot}`} />
        </span>
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-slate-600">{statusText}</span>
        {latencyMs !== undefined && latencyMs !== null && (
          <span className="text-[13px] text-slate-400">
            {latencyLabel}: <b className="text-slate-700">{latencyMs} ms</b>
          </span>
        )}
      </div>

      {rows.length > 0 && (
        <div className="flex flex-col gap-1 pt-2 border-t border-slate-100">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-2 text-[12px]">
              <span className="text-slate-400 truncate">{r.label}</span>
              <span className="text-slate-700 font-medium whitespace-nowrap">
                {r.value ?? "—"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
