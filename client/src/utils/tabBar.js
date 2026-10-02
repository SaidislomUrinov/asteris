// Mobil pastki tab-bar tarkibi — YAGONA manba. Ham `MobileTabBar` (chizish
// uchun), ham `Navbar` (mobil menyuda takrorlanmasligi uchun) shu yerdan
// oladi. Alohida util faylda turadi, chunki komponent fayli bilan bir joyda
// eksport qilinsa Vite "Fast refresh only works when a file only exports
// components" xatosini beradi.

// Rolga qarab eng ko'p ishlatiladigan bo'limlar (tartib muhim — birinchi
// mos keluvchi 5 tasi olinadi).
const ROLE_TAB_KEYS = {
  owner: ["dashboard", "centers", "staff", "groups", "students"],
  teacher: ["dashboard", "lesson", "groups", "finance", "profile"],
  // Yordamchi o'qituvchi — o'qituvchi bilan bir xil ish oqimi.
  assistant: ["dashboard", "lesson", "groups", "finance", "profile"],
  default: ["dashboard", "students", "groups", "finance", "profile"],
};

// `availability` xaritasi — qaysi bo'lim umuman mavjud (rol/permission
// bo'yicha). Navbar ham, TabBar ham bir xil qurishi uchun shu yerda.
export const buildTabAvailability = (authType, can) => ({
  dashboard: true,
  centers: authType === "owner",
  staff: authType === "owner",
  rooms: can("room:view"),
  groups: can("group:view"),
  students: can("student:view"),
  lesson: authType === "staff",
  salary: can("salary:view"),
  finance: authType === "staff",
  profile: authType === "staff",
});

// Tab-bar'da HAQIQATDA ko'rinadigan kalitlar (maksimum 5 ta).
export const resolveTabKeys = (authType, role, availability) => {
  const keys =
    authType === "owner"
      ? ROLE_TAB_KEYS.owner
      : ROLE_TAB_KEYS[role] || ROLE_TAB_KEYS.default;
  return keys.filter((key) => availability[key]).slice(0, 5);
};
