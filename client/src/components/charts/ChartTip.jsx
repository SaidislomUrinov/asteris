// Grafiklarning umumiy tooltip qutisi: sarlavha + qatorlar (rangli nuqta,
// yorliq, qiymat). Matn grafik rangida emas — identifikatsiya nuqtada.
function ChartTip({ title, rows = [] }) {
  return (
    <div className="min-w-40 px-3 py-2.5 rounded-xl border bg-white dark:bg-night-900 border-slate-200 dark:border-night-700 text-xs text-slate-800 dark:text-slate-100 shadow-lg shadow-slate-900/5 dark:shadow-none">
      {title && <p className="mb-1.5 font-medium text-slate-500 dark:text-slate-400">{title}</p>}
      <div className="flex flex-col gap-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5">
              {r.color && <span className="size-2 rounded-full" style={{ background: r.color }} />}
              {r.label}
            </span>
            <span className="font-semibold tabular-nums">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ChartTip;
