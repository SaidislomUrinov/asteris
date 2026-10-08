import { Skeleton } from "../../components/Skeleton";
import { cn } from "../../utils/cn";

// KPI kartalari skeleti — KpiCard bilan bir xil o'lcham (yorliq + qiymat).
export const KpiSkeleton = ({ cols = 3, count = cols }) => (
  <div className={cn("grid gap-2", cols === 2 ? "grid-cols-2" : "grid-cols-3")}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bg-card rounded-2xl px-3 py-2.5 border border-line/70 flex flex-col gap-2">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-5 w-16" />
      </div>
    ))}
  </div>
);

// "Bugun" lentasi skeleti: vaqt · nuqta · karta.
export const TimelineSkeleton = ({ count = 4 }) => (
  <div className="relative flex flex-col gap-2">
    <div className="absolute left-[51px] top-2 bottom-2 w-0.5 rounded-full bg-line" aria-hidden="true" />
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="grid grid-cols-[44px_16px_minmax(0,1fr)] items-start">
        <Skeleton className="h-3 w-8 mt-3" />
        <span className="relative z-[1] w-3 h-3 mt-3 ml-0.5 rounded-full bg-card border-[2.5px] border-line" aria-hidden="true" />
        <div className="ml-1.5 bg-card rounded-2xl px-3 py-2.5 border border-line/70 flex flex-col gap-2">
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    ))}
  </div>
);

// Sarlavha kartasi skeleti (guruh / o'quvchi profili).
export const HeaderCardSkeleton = () => (
  <div className="bg-card rounded-2xl p-3.5 border border-line/70 flex flex-col gap-3">
    <div className="flex items-center justify-between gap-3">
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="h-5 w-14 rounded-full" />
    </div>
    <Skeleton className="h-4 w-2/3" />
    <Skeleton className="h-4 w-1/2" />
    <Skeleton className="h-4 w-1/3" />
  </div>
);

// Karta ichidagi qatorlar skeleti: avatar + ikki satr (o'quvchi/davomat qatorlari).
export const RowsSkeleton = ({ count = 5 }) => (
  <div className="bg-card rounded-2xl px-3.5 py-1 border border-line/70 divide-y divide-line/70">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex items-center gap-2.5 py-2.5">
        <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
        <div className="flex-1 flex flex-col gap-2">
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
    ))}
  </div>
);

// Alohida kartalar skeleti (guruhlar ro'yxati, a'zolik/xulosa kartalari).
export const CardsSkeleton = ({ count = 3 }) => (
  <div className="flex flex-col gap-2.5">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bg-card rounded-2xl p-3.5 border border-line/70 flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    ))}
  </div>
);
