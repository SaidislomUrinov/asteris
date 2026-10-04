// Oylik yutuq nishonlari (docs/API_CONTRACT_badges_monthly_rank.md §C/§D).
// Tartib server `utils/badge.util.js#BADGE_TYPES` bilan AYNAN bir xil —
// ro'yxat va progress bloklari shu tartibda chiziladi.
export const BADGE_TYPES = [
  "perfectAttendance",
  "excellent",
  "perfect",
  "attendanceStreak",
  "gradeStreak",
  "champion",
  "mostImproved",
  "podiumStreak",
  "goldCollection",
  "bigJump",
];

// Tarif flagi — o'chiq bo'lsa badge UI butunlay yashirin, API chaqirilmaydi.
export const BADGE_FEATURE = "gamification.badges";

// Markaz baholarni yashirsa (`showGrades=false`) server bu turlarni qaytarmaydi.
export const GRADE_BADGE_TYPES = [
  "excellent",
  "perfect",
  "gradeStreak",
  "champion",
  "mostImproved",
  "podiumStreak",
  "goldCollection",
  "bigJump",
];

// Metall emblem palitrasi: hi → mid → lo — yuz gradienti, rim — chekka qirra,
// glyph — markaziy belgi rangi, accent — ikkinchi rang (champion: qizil lenta).
// Parent `src/utils/badges.js` bilan AYNAN bir xil qiymatlar — glif geometriyasi
// esa `ui/BadgeIcon.jsx` ichida (parent `components/BadgeIcon.jsx` bilan bir xil).
export const BADGE_PALETTE = {
  perfectAttendance: { hi: "#A7F3D0", mid: "#10B981", lo: "#047857", rim: "#064E3B", glyph: "#ECFDF5" },
  excellent: { hi: "#BFDBFE", mid: "#3B82F6", lo: "#1D4ED8", rim: "#1E3A8A", glyph: "#EFF6FF" },
  perfect: { hi: "#FFF3B0", mid: "#F5C542", lo: "#B7791F", rim: "#8A5A0B", glyph: "#FFFBEB" },
  attendanceStreak: { hi: "#FDE68A", mid: "#F97316", lo: "#DC2626", rim: "#7F1D1D", glyph: "#FFF7ED" },
  gradeStreak: { hi: "#E9D5FF", mid: "#A855F7", lo: "#6D28D9", rim: "#4C1D95", glyph: "#FAF5FF" },
  champion: { hi: "#FFF3B0", mid: "#F5C542", lo: "#B7791F", rim: "#991B1B", glyph: "#FFFBEB", accent: "#DC2626" },
  mostImproved: { hi: "#99F6E4", mid: "#14B8A6", lo: "#0F766E", rim: "#134E4A", glyph: "#F0FDFA" },
  podiumStreak: { hi: "#FECDD3", mid: "#F43F5E", lo: "#BE123C", rim: "#881337", glyph: "#FFF1F2" },
  goldCollection: { hi: "#FEF3C7", mid: "#F59E0B", lo: "#B45309", rim: "#78350F", glyph: "#FFFBEB", accent: "#2563EB" },
  bigJump: { hi: "#BAE6FD", mid: "#0EA5E9", lo: "#0369A1", rim: "#0C4A6E", glyph: "#F0F9FF" },
};

export const badgeNameKey = (type) => `badge.types.${type}.name`;
export const badgeDescKey = (type) => `badge.types.${type}.desc`;

/** "2026-09" → "Sentabr 2026" (`common.monthNames` orqali). */
export function formatBadgeMonth(month, monthNames) {
  if (!month) return "";
  const [y, m] = month.split("-").map(Number);
  return `${monthNames?.[m - 1] || ""} ${y}`.trim();
}

/** "2026-09" → "Sentabr" (faqat oy nomi — reyting yozuvi uchun). */
export function monthNameOf(month, monthNames) {
  if (!month) return "";
  const m = Number(month.split("-")[1]);
  return monthNames?.[m - 1] || "";
}

/** Joriy oy (Asia/Tashkent) — "YYYY-MM". */
export function currentMonthTashkent() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}`;
}


// Yutuqlar kartasi holatlari — server `membershipState` bilan bir xil tartib
// (API_CONTRACT_student_achievements.md, 2026-10-03).
export const ACHIEVEMENT_STATES = ["active", "finished", "left", "archived"];

/** Unix SONIYA (server `getNow()`) → "YYYY-MM" (Asia/Tashkent) — `formatBadgeMonth` uchun. */
export function monthOfTs(ts) {
  if (!ts) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date(ts * 1000));
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}`;
}
