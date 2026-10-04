import { isSectionActive } from "../utils/navSections";

// Bilimlar bazasi — har bo'lim uchun statik yordam maqolasi (Top.jsx'dagi "?"
// tugmasi). Kontent `content/{til}.js` da, bo'lim kaliti bo'yicha:
//   { summary: "...", blocks: [{ type, text | items }] }
// Blok turlari (KnowledgeArticle.jsx render qiladi):
//   h     — kichik sarlavha            p    — paragraf
//   ul    — belgili ro'yxat            steps — raqamlangan qadamlar
//   tip   — maslahat (ko'k)            warn — diqqat (sariq)
// Matn ichida: **qalin** va [[Tugma nomi]] (UI yorlig'i chip ko'rinishida).

// Marshrut → maqola kaliti. Eng uzun mos prefiks yutadi, shuning uchun
// `/reports/teacher-performance` `/reports` dan ustun turadi. Detail
// sahifalar (`/groups/:id`) ota bo'lim maqolasini oladi.
const KNOWLEDGE_ROUTES = [
  "/dashboard",
  "/centers",
  "/staff",
  "/subjects",
  "/rooms",
  "/groups",
  "/schedule",
  "/calendar",
  "/lesson",
  "/my-plans",
  "/students",
  "/leads",
  "/qr-attendance",
  "/salary",
  "/expenses",
  "/revenue",
  "/reports",
  "/reports/teacher-performance",
  "/audit-log",
  "/subscription",
  "/notifications",
  "/profile",
  "/finance",
  "/certificates",
  "/archive",
];

const TEACHING_ROLES = ["teacher", "assistant"];

// Bir xil manzil rolga qarab boshqa sahifa ko'rsatadi (App.jsx): `/dashboard`
// o'qituvchiga TeacherHome, qabulxonaga ReceptionHome; `/profile` hodimga
// StaffProfile. Maqola ham shunga mos tanlanadi.
export const resolveKnowledgeKey = (pathname, { authType, role } = {}) => {
  const path = KNOWLEDGE_ROUTES.filter((p) => isSectionActive(pathname, p)).sort(
    (a, b) => b.length - a.length,
  )[0];
  if (!path) return null;
  const key = path.slice(1);
  const isStaff = authType === "staff";
  if (key === "dashboard" && isStaff && TEACHING_ROLES.includes(role)) return "dashboard.teacher";
  if (key === "dashboard" && isStaff && role === "reception") return "dashboard.reception";
  if (key === "profile" && isStaff) return "profile.staff";
  return key;
};

// Har til alohida chunk — foydalanuvchi faqat o'z tilidagi kontentni yuklaydi.
const LOADERS = {
  uz: () => import("./content/uz.js"),
  uzc: () => import("./content/uzc.js"),
  ru: () => import("./content/ru.js"),
  en: () => import("./content/en.js"),
};

export const SUPPORTED_KB_LANGS = Object.keys(LOADERS);

const cache = {};

export const loadKnowledge = async (lang) => {
  const code = LOADERS[lang] ? lang : "uz";
  if (!cache[code]) cache[code] = (await LOADERS[code]()).default;
  return cache[code];
};
