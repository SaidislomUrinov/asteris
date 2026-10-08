/** Reja kartasi skeleti — ro'yxat yuklanayotganda. */
function PlanCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 animate-pulse">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 shrink-0 rounded-xl bg-slate-100 dark:bg-night-800" />
        <div className="flex flex-col flex-1 gap-2">
          <span className="h-4 w-3/4 rounded bg-slate-100 dark:bg-night-800" />
          <span className="h-4 w-20 rounded bg-slate-100 dark:bg-night-800" />
        </div>
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-night-700">
        <span className="h-3 w-24 rounded bg-slate-100 dark:bg-night-800" />
        <span className="h-3 w-20 rounded bg-slate-100 dark:bg-night-800" />
      </div>
    </div>
  );
}

export default PlanCardSkeleton;
