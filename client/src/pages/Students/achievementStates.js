import { HiArchiveBox, HiArrowRightOnRectangle, HiCheckCircle, HiPlay } from "react-icons/hi2";

// Holat pill ranglari + ikonka (API_CONTRACT_student_achievements.md, 2026-10-03).
export const STATE_META = {
  active: { tone: "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-emerald-600/15", dot: "bg-emerald-500", Icon: HiPlay },
  finished: { tone: "bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 ring-blue-600/15", dot: "bg-blue-500", Icon: HiCheckCircle },
  left: { tone: "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-amber-600/15", dot: "bg-amber-500", Icon: HiArrowRightOnRectangle },
  archived: { tone: "bg-slate-100 dark:bg-night-800 text-slate-600 dark:text-slate-300 ring-slate-500/15", dot: "bg-slate-400", Icon: HiArchiveBox },
};
