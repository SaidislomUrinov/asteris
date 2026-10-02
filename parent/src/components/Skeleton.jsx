import { cn } from "../utils/cn";

export const Skeleton = ({ className }) => (
  <div className={cn("animate-pulse rounded-xl bg-ink/8", className)} />
);

export const CardSkeleton = ({ lines = 2, className }) => (
  <div className={cn("bg-card rounded-2xl p-3.5 flex gap-3 items-center", className)}>
    <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
    <div className="flex-1 space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-3.5", i === 0 ? "w-2/3" : "w-1/2")} />
      ))}
    </div>
  </div>
);

export const ListSkeleton = ({ count = 3 }) => (
  <div className="space-y-2.5">
    {Array.from({ length: count }).map((_, i) => (
      <CardSkeleton key={i} />
    ))}
  </div>
);

export const StatSkeleton = () => (
  <div className="grid grid-cols-3 gap-2">
    {[0, 1, 2].map((i) => (
      <div key={i} className="bg-card rounded-2xl p-3 flex flex-col items-center gap-2">
        <Skeleton className="h-5 w-12" />
        <Skeleton className="h-3 w-16" />
      </div>
    ))}
  </div>
);
