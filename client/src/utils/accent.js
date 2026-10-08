// Detail sahifalari tepasidagi kartalar uchun yagona rang palitrasi.
// Karta HECH QACHON to'liq rangga bo'yalmaydi — rang faqat chap chekka
// chizig'i va ikonka kvadratida ishlatiladi (/rooms va /groups bilan bir xil
// vizual til). Shu tufayli bir qatorda 3-4 ta karta turganda ham ko'z
// charchamaydi va asosiy raqam matni har doim to'q rangda, o'qishli qoladi.
export const ACCENT = {
  blue: { edge: "bg-blue-500", icon: "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  indigo: { edge: "bg-indigo-500", icon: "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400" },
  violet: { edge: "bg-violet-500", icon: "bg-violet-50 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  emerald: { edge: "bg-emerald-500", icon: "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  cyan: { edge: "bg-cyan-500", icon: "bg-cyan-50 dark:bg-cyan-500/15 text-cyan-600 dark:text-cyan-400" },
  amber: { edge: "bg-amber-500", icon: "bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  orange: { edge: "bg-orange-500", icon: "bg-orange-50 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400" },
  red: { edge: "bg-red-500", icon: "bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400" },
  slate: { edge: "bg-slate-400", icon: "bg-slate-100 dark:bg-night-800 text-slate-500 dark:text-slate-400" },
};

export const accentOf = (name) => ACCENT[name] || ACCENT.blue;
