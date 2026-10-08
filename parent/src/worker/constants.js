import {
  HiOutlineSun, HiSun, HiOutlineWallet, HiWallet, HiOutlineBell, HiBell,
  HiOutlineUser, HiUser, HiOutlineExclamationCircle, HiExclamationCircle,
  HiOutlineFunnel, HiFunnel, HiOutlineUserGroup, HiUserGroup,
  HiOutlineStar, HiStar, HiChartBar, HiPlus, HiCheck,
  HiOutlineSquares2X2, HiSquares2X2, HiOutlineQrCode, HiQrCode,
  HiOutlineLifebuoy, HiLifebuoy,
} from "react-icons/hi2";

// Rol rangi — faqat rol belgisi, faol tab va markaziy tugmada (§5).
export const ROLE_COLORS = {
  owner: "#4f46e5",
  reception: "#0d9488",
  teacher: "#d97706",
  assistant: "#9333ea",
};

// Tab / menyu bandlari. `perm` — RBAC ruxsati, `feature` — tarif funksiyasi,
// `only` — faqat shu rollar uchun (masalan Hisobot — `/students/revenue`
// server tomonda faqat Boshliqqa ochiq). Ruxsat/tarif yo'q bo'lsa band
// umuman ko'rinmaydi (details §1).
export const TAB_DEFS = {
  today: { to: "/", key: "worker.tab.today", on: HiSun, off: HiOutlineSun },
  finance: { to: "/finance", key: "worker.tab.finance", on: HiWallet, off: HiOutlineWallet, perm: "dashboard:view", only: ["owner", "reception"] },
  report: { to: "/report", key: "worker.fab.report", on: HiChartBar, off: HiChartBar, perm: "dashboard:view", only: ["owner"] },
  // O'qituvchi rollari `/students` ni guruhsiz ola olmaydi (teacherStudentScope).
  debtors: { to: "/debtors", key: "worker.tab.debtors", on: HiExclamationCircle, off: HiOutlineExclamationCircle, perm: "student:view", only: ["owner", "reception"] },
  leads: { to: "/leads", key: "worker.tab.leads", on: HiFunnel, off: HiOutlineFunnel, perm: "lead:view" },
  groups: { to: "/groups", key: "worker.tab.groups", on: HiUserGroup, off: HiOutlineUserGroup, perm: "group:view" },
  // Oylik — hodimning o'zi (Boshliqda shaxsiy oylik yo'q).
  salary: { to: "/salary", key: "worker.tab.salary", on: HiWallet, off: HiOutlineWallet, only: ["reception", "teacher", "assistant"] },
  // Baho qo'yish — faqat darsni olib boruvchi (grade.service WRITER_ROLES).
  grades: { to: "/grades", key: "worker.tab.grades", on: HiStar, off: HiOutlineStar, perm: "attendance:view", feature: "student.rate", only: ["teacher", "assistant"] },
  notifications: { to: "/notifications", key: "worker.tab.notifications", on: HiBell, off: HiOutlineBell },
  profile: { to: "/profile", key: "worker.tab.profile", on: HiUser, off: HiOutlineUser },
  menu: { to: "/menu", key: "worker.tab.menu", on: HiSquares2X2, off: HiOutlineSquares2X2 },
  // QR davomat — yozish amali (`writes`): obuna tugagan (readOnly) bo'lsa yashiriladi.
  qr: { to: "/qr", key: "worker.qr.title", on: HiQrCode, off: HiOutlineQrCode, perm: "attendance:create", feature: "attendance.qr", writes: true },
  // Yordam chati (API_CONTRACT_qr_card_send_and_worker_chat.md §B) — hamma
  // ishchiga ochiq (server: tenantAuth), obuna tugaganda ham ishlaydi.
  support: { to: "/support", key: "worker.support.title", on: HiLifebuoy, off: HiOutlineLifebuoy },
};

// Band shu rol va ruxsat/tarif uchun ochiqmi.
export const defAllowed = (def, role, can, hasFeature, readOnly = false) =>
  !!def && (!def.only || def.only.includes(role)) && can(def.perm) && hasFeature(def.feature) && !(def.writes && readOnly);

// QR davomat ko'rinish sharti (API_CONTRACT_worker_qr_attendance.md §2).
export const qrAllowed = ({ can, hasFeature, readOnly }) => defAllowed(TAB_DEFS.qr, null, can, hasFeature, readOnly);

// QR kartani Telegramga yuborish bandi (§A.3): ko'rinish sharti QR karta
// ochiladigan joylar bilan bir xil; bosiladigan — kamida bittasi ulangan.
// Holat noma'lum bo'lsa (masalan o'qituvchi sahifaga to'g'ridan-to'g'ri
// kirgan) — bosiladi, server o'zi `attendance.qrNoTelegram` qaytaradi.
export const qrSendAllowed = ({ can, hasFeature }) => hasFeature("attendance.qr") && can("attendance:view");
export const qrSendEnabled = (s) =>
  !s || (s.studentTelegram == null && s.parentTelegram == null) || s.studentTelegram === "linked" || s.parentTelegram === "linked";

// Bir xil kartani shu oraliqda qayta o'qish e'tiborsiz (client bilan bir xil).
export const QR_RESCAN_COOLDOWN = 3000;

// Markaziy amal (FAB). `sheet` — bottom sheet, `to` — sahifa.
export const FAB_DEFS = {
  report: { key: "worker.fab.report", icon: HiChartBar, to: "/report", perm: "dashboard:view" },
  payment: { key: "worker.fab.payment", icon: HiPlus, sheet: "payment", perm: "payment:create" },
  attendance: { key: "worker.fab.attendance", icon: HiCheck, sheet: "attendance", perm: "attendance:create" },
};

// Rol → [tab1, tab2, FAB, tab4, tab5] (details §1 jadvali).
export const ROLE_LAYOUT = {
  owner: ["today", "groups", "report", "finance", "menu"],
  reception: ["today", "groups", "payment", "debtors", "menu"],
  teacher: ["today", "groups", "attendance", "salary", "menu"],
  assistant: ["today", "groups", "attendance", "grades", "menu"],
};

// "Menyu" sahifasidagi bandlar tartibi — tab bar'ga sig'maganlari shu yerda.
export const MENU_ORDER = ["qr", "finance", "report", "debtors", "leads", "grades", "salary", "notifications", "support", "profile"];

// Tab bar ko'rinmaydigan to'liq ekranli sahifalar (yozish maydoni pastda).
export const FULLSCREEN_PATHS = ["/support"];

// Chat xabari yuboruvchisi — o'zimniki (owner/hodim), admin yoki tizim.
export const isMineSender = (m) => m?.sender?.kind === "client" || m?.sender?.kind === "staff";
// Chatga yuklanadigan rasm (server: jpg/jpeg/png/webp, global limit 10 MB).
export const CHAT_IMAGE_TYPES = "image/png,image/jpeg,image/webp";
export const CHAT_IMAGE_MAX = 10 * 1024 * 1024;
export const CHAT_PAGE = 30;
export const CHAT_FIRST_PAGE = 50;

// O'qituvchi rollari — moliyaviy ma'lumot va to'liq o'quvchi kartasi yo'q.
export const TEACHING_ROLES = ["teacher", "assistant"];

// Yutuq nishonlari tarif flagi (server utils/badge.util.js BADGE_FEATURE).
export const BADGE_FEATURE = "gamification.badges";

// `/worker/today` ni qayta yuklaydigan mavjud server eventlari (§4).
export const LIVE_EVENTS = [
  "payment:created",
  "payment:cancelled",
  "payment:updated",
  "attendance:marked",
  "group:changed",
  "lead:changed",
  "expense:created",
  "expense:updated",
  "grade:set",
  "grade:removed",
  "homework:updated",
  "salary:updated",
  "student:enrolled",
  "student:leftGroup",
  "subscription:updated",
];
export const LIVE_DEBOUNCE_MS = 800;

// Davomat — server qabul qiladigan statuslar (attendance.service mark()).
// "Kechikdi" alohida status emas, server o'zi qo'yadigan `late` belgisi.
export const ATTENDANCE_MARKS = ["present", "absent", "excused"];

export const PAYMENT_TYPES = ["cash", "card", "mixed"];

// Tab bar'dagi sahifalar (rol bo'yicha) — ulardan tashqaridagilar "ichki"
// sahifa: Telegram BackButton / sahifadagi "orqaga" ko'rinadi.
export const rootPathsOf = (role) =>
  (ROLE_LAYOUT[role] || ROLE_LAYOUT.teacher).map((k) => TAB_DEFS[k]?.to).filter(Boolean);
