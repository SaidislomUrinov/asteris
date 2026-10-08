const CARD = "rounded-xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900";
const BAR = "rounded-md bg-slate-100 dark:bg-night-800";

/**
 * Birinchi yuklanishdagi skeleton — haqiqiy layout (KPI qatori, chapda
 * darslar + guruhlar, o'ngda oylik) bilan bir xil o'lcham va panjara, ma'lumot
 * kelganda sahifa sakramaydi.
 */
function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-3 animate-pulse" aria-busy="true">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="h-32 rounded-2xl bg-slate-100 dark:bg-night-800" />
        <div className="grid grid-cols-2 gap-3 lg:col-span-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`flex items-center gap-3 p-3.5 ${CARD}`}>
              <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-night-800" />
              <div className="flex flex-col gap-2">
                <div className={`h-4 w-10 ${BAR}`} />
                <div className={`h-3 w-20 ${BAR}`} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px] gap-3 items-start">
        <div className="flex flex-col gap-3 min-w-0">
          <div className={`flex flex-col gap-3 p-5 ${CARD}`}>
            <div className={`h-5 w-36 ${BAR}`} />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-[62px] rounded-xl bg-slate-50 dark:bg-night-800 border border-slate-100 dark:border-night-700" />
            ))}
          </div>
          <div className={`flex flex-col gap-3 p-5 ${CARD}`}>
            <div className={`h-5 w-40 ${BAR}`} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-[104px] rounded-xl bg-slate-50 dark:bg-night-800 border border-slate-100 dark:border-night-700" />
              ))}
            </div>
          </div>
          <div className={`flex flex-col gap-3 p-5 ${CARD}`}>
            <div className={`h-5 w-44 ${BAR}`} />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={`h-10 ${BAR}`} />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3 min-w-0">
          <div className={`flex flex-col gap-3 p-5 ${CARD}`}>
            <div className="flex items-center justify-between">
              <div className={`h-5 w-24 ${BAR}`} />
              <div className="h-9 w-36 rounded-full bg-slate-100 dark:bg-night-800" />
            </div>
            <div className="mx-auto w-40 h-40 rounded-full border-[14px] border-slate-100 dark:border-night-700" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={`h-5 ${BAR}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardSkeleton;
