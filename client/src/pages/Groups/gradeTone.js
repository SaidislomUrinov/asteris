// Baho rangi — 9–10 yashil, 7–8 ko'k, 5–6 sariq, 3–4 to'q sariq, 1–2 qizil.
// Ko'rinish davomat kataklari (`AttendanceCheckbox`) bilan bir xil: to'q
// to'ldirish emas, yumshoq `color/12` fon + to'q raqam + ichki `ring`.
// GradesTab va ro'yxatdagi GradeCell — bitta manba.
const TONE_BY_BAND = [
  "bg-red-500/12 text-red-500 ring-red-500/30",
  "bg-orange-500/15 text-orange-600 dark:text-orange-400 ring-orange-500/30",
  "bg-amber-400/20 text-amber-700 dark:text-amber-400 ring-amber-400/40",
  "bg-blue-500/12 text-blue-600 dark:text-blue-400 ring-blue-500/30",
  "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 ring-emerald-500/30",
];

export const toneOf = (v) => TONE_BY_BAND[Math.min(4, Math.max(0, Math.ceil(v / 2) - 1))];

// 10 ballik shkala (API_CONTRACT_grade_scale10.md §3) — tanlovda ikki qator.
export const VALUE_ROWS = [
  [10, 9, 8, 7, 6],
  [5, 4, 3, 2, 1],
];
