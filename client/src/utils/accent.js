// Detail sahifalari tepasidagi kartalar uchun yagona rang palitrasi.
// Karta HECH QACHON to'liq rangga bo'yalmaydi — rang faqat chap chekka
// chizig'i va ikonka kvadratida ishlatiladi (/rooms va /groups bilan bir xil
// vizual til). Shu tufayli bir qatorda 3-4 ta karta turganda ham ko'z
// charchamaydi va asosiy raqam matni har doim to'q rangda, o'qishli qoladi.
export const ACCENT = {
  blue: { edge: "bg-blue-500", icon: "bg-blue-50 text-blue-600" },
  indigo: { edge: "bg-indigo-500", icon: "bg-indigo-50 text-indigo-600" },
  violet: { edge: "bg-violet-500", icon: "bg-violet-50 text-violet-600" },
  emerald: { edge: "bg-emerald-500", icon: "bg-emerald-50 text-emerald-600" },
  cyan: { edge: "bg-cyan-500", icon: "bg-cyan-50 text-cyan-600" },
  amber: { edge: "bg-amber-500", icon: "bg-amber-50 text-amber-600" },
  orange: { edge: "bg-orange-500", icon: "bg-orange-50 text-orange-600" },
  red: { edge: "bg-red-500", icon: "bg-red-50 text-red-600" },
  slate: { edge: "bg-slate-400", icon: "bg-slate-100 text-slate-500" },
};

export const accentOf = (name) => ACCENT[name] || ACCENT.blue;
