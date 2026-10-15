import { HiCheck, HiMinus, HiXMark } from "react-icons/hi2";

// Uyga vazifa natija turlari (API_CONTRACT_wecoin.md §1.1) — client
// `pages/Groups/homeworkResults.js` bilan bir xil tartib va ranglar
// (davomatdan ataylab farqli: osmon/to'q sariq/qizg'ish, dumaloq tugma).
export const RESULT_OPTIONS = [
  { key: "done", icon: HiCheck, on: "bg-sky-500 text-white", pill: "bg-sky-500/12 text-sky-600", bar: "bg-sky-500" },
  { key: "partial", icon: HiMinus, on: "bg-orange-500 text-white", pill: "bg-orange-500/12 text-orange-600", bar: "bg-orange-500" },
  { key: "missed", icon: HiXMark, on: "bg-rose-500 text-white", pill: "bg-rose-500/12 text-rose-600", bar: "bg-rose-500" },
];

// "Chala" yarim ball — client "Bajarilish" foizi bilan bir xil hisob.
export const completionPercent = (counts, total) =>
  total ? Math.round(((counts.done + counts.partial / 2) / total) * 100) : 0;
