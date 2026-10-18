// Bosh sahifa ro'yxatlari (bugungi darslar, qarzdorlar) birinchi yuklanishdagi
// skelet — haqiqiy qator shakli (chapda 2 qatorli matn, o'ngda qiymat) va
// karta qirralarigacha cho'zilgan bo'luvchi chiziqlar bilan bir xil.
// `avatar` — qarzdorlar qatori (34px avatar) balandligiga moslash uchun.
function ListSkeleton({ rows = 4, avatar = false }) {
  return (
    <div
      aria-busy="true"
      className="flex flex-col divide-y divide-slate-100 dark:divide-night-700 border-t border-slate-100 dark:border-night-700 -mx-5 -mb-5 animate-pulse"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`flex items-center gap-3 px-5 ${avatar ? "py-2.5 min-h-[65px]" : "py-3"}`}>
          {avatar && <div className="size-[34px] shrink-0 rounded-full bg-slate-100 dark:bg-night-800" />}
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            <div className="h-3.5 w-2/5 rounded-md bg-slate-100 dark:bg-night-800" />
            <div className="h-3 w-3/5 rounded-md bg-slate-100 dark:bg-night-800" />
          </div>
          <div className="h-3.5 w-20 shrink-0 rounded-md bg-slate-100 dark:bg-night-800" />
        </div>
      ))}
    </div>
  );
}

export default ListSkeleton;
