import { Skeleton } from "../../components/Skeleton";
import { cn } from "../../utils/cn";

const ROWS = [
  { mine: false, w: "w-2/3", h: "h-12" },
  { mine: true, w: "w-1/2", h: "h-9" },
  { mine: false, w: "w-3/5", h: "h-16" },
  { mine: true, w: "w-2/5", h: "h-9" },
];

// Chat yuklanayotganda — navbatma-navbat pufakchalar.
export const ChatSkeleton = () => (
  <div className="flex flex-col gap-2.5 py-2">
    {ROWS.map((r, i) => (
      <Skeleton key={i} className={cn("rounded-2xl", r.w, r.h, r.mine && "self-end")} />
    ))}
  </div>
);
