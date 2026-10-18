const BAR = "rounded-md bg-slate-100 dark:bg-night-800";

/**
 * Dashboard analitika kartalarining birinchi yuklanishdagi skeletoni —
 * haqiqiy karta qobig'i (padding, chegara, `h-full`) bilan bir xil, ma'lumot
 * kelganda karta o'rnida qoladi, faqat ichi almashadi (sakrash yo'q).
 * `variant`: donut | chart | list.
 */
function PanelSkeleton({ variant = "list", rows = 4 }) {
  return (
    <div
      aria-busy="true"
      className="flex flex-col gap-3 p-5 rounded-xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 h-full min-h-0 animate-pulse"
    >
      <div className="flex flex-col gap-1.5 shrink-0">
        <div className={`h-4 w-40 ${BAR}`} />
        <div className={`h-3 w-56 max-w-full ${BAR}`} />
      </div>

      {variant === "donut" && (
        <>
          <div className="flex flex-1 items-center justify-center min-h-32">
            <div className="w-32 h-32 rounded-full border-[14px] border-slate-100 dark:border-night-800" />
          </div>
          <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-night-700 shrink-0">
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <div className={`h-3 w-24 ${BAR}`} />
                <div className={`h-3 w-12 ${BAR}`} />
              </div>
            ))}
          </div>
        </>
      )}

      {variant === "chart" && <div className="flex-1 min-h-48 rounded-lg bg-slate-50 dark:bg-night-800/60" />}

      {variant === "list" && (
        <div className="flex flex-col gap-3 flex-1 min-h-0">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full shrink-0 bg-slate-100 dark:bg-night-800" />
              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                <div className={`h-3 w-2/3 ${BAR}`} />
                <div className={`h-2.5 w-1/3 ${BAR}`} />
              </div>
              <div className={`h-3 w-14 shrink-0 ${BAR}`} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PanelSkeleton;
