// Rolga qarab ruxsatlarni cheklash — docs/teacher-scope-updates.md §1.
//
// O'qituvchi va yordamchi o'qituvchi FAQAT dars jarayoniga tegishli ishlarni
// bajaradi. To'lov olish, ish haqi tarqatish, xarajat kiritish, o'quvchi/guruh/
// fan CRUD — bular Resepshin va Boshliqning ishi, shuning uchun bu rollarga
// bunday ruxsatlarni berib bo'lmaydi (frontendda ro'yxatdan yashiriladi,
// bu yerda esa yakuniy tozalash bajariladi).

const TEACHING_ROLES = ["teacher", "assistant"];

const TEACHING_ALLOWED_PERMISSIONS = [
  "group:view",
  "group:create",
  "group:update",
  "student:view",
  "student:create",
  // O'quvchining faqat kontakt maydonlari (ism, raqam, ota-ona raqami) —
  // o'z guruhidagi o'quvchi uchun (API_CONTRACT_student_contact_telegram.md §1).
  "student:contact",
  "subject:view",
  "attendance:view",
  "attendance:create",
  "attendance:update",
  "lesson:view",
  "lesson:create",
  "lesson:update",
  // Markaz kalendari — o'qituvchi/yordamchi FAQAT ko'radi (dam olish
  // kunlarini belgilash/bekor qilish `calendar:manage` — bu ro'yxatda yo'q,
  // shu bilan avtomatik cheklanadi).
  "calendar:view",
];

// Oylik hisoblash usuli ham `permissions` massivida saqlanadi, lekin bu
// "ruxsat" emas — o'qituvchi ham foizli/qat'iy oylikda ishlashi
// mumkin, shuning uchun doiradan tashqarida bo'lsa ham saqlanadi.
// Hisobotlar (`report:*`) — MOLIYAVIY kesim (tushum, oylik, qarzdorlik,
// o'qituvchilar reytingi). O'qituvchi/yordamchi bu sahifaga umuman
// kirmaydi (API_CONTRACT.md §2.2). Quyidagi oq ro'yxatda yo'qligi allaqachon
// yetarli, lekin niyat ochiq ko'rinib turishi uchun alohida e'lon qilinadi
// va sanitize'da qo'shimcha to'siq sifatida ishlatiladi.
const TEACHING_DENIED_PERMISSIONS = ["report:view", "report:export"];

// DIQQAT — NOM TO'QNASHUVI: bir xil satr ikki xil ma'noda ishlatiladi.
//  1) `Staff.permissions` ichida — HODIMNING OYLIK TURI (qaysi usulda
//     hisoblanadi). Bu RBAC ruxsati emas, shunchaki saqlash joyi.
//  2) `Tariff.allowedPermissions` ichida — TARIF FLAGI (shu oylik turini
//     hodimlarga berish imkoniyati tarifda ochiqmi).
// Mavjud hujjatlar buzilmasligi uchun satrlar o'zgartirilmadi; kodda esa
// ikkala ma'no alohida konstanta bilan ifodalanadi.
const STAFF_SALARY_TYPE_KEYS = [
  "staff.salary.percentage",
  "staff.salary.fixed",
];
// Hodim oylik turi → uni ochadigan tarif flagi (hozircha 1:1 bir xil satr).
const SALARY_TYPE_TARIFF_FLAG = {
  "staff.salary.percentage": "staff.salary.percentage",
  "staff.salary.fixed": "staff.salary.fixed",
};
// Orqaga moslik uchun eski nom.
const SALARY_TYPE_PERMISSIONS = STAFF_SALARY_TYPE_KEYS;

// Ruxsatlar ro'yxatidan hodimning oylik turi kalitini (yoki null) oladi.
const salaryTypeKeyOf = (permissions) =>
  (Array.isArray(permissions) ? permissions : []).find((p) => STAFF_SALARY_TYPE_KEYS.includes(p)) ||
  null;

/**
 * Rolga mos kelmaydigan ruxsatlarni olib tashlaydi.
 * Xato tashlamaydi — rol o'zgartirilganda eski ruxsatlar jimgina tozalanishi
 * kerak (masalan resepshin -> o'qituvchi).
 */
const sanitizeStaffPermissions = (role, permissions) => {
  const list = Array.isArray(permissions) ? permissions : [];
  if (!TEACHING_ROLES.includes(role)) return list;

  let filtered = list.filter(
    (p) =>
      !TEACHING_DENIED_PERMISSIONS.includes(p) &&
      (TEACHING_ALLOWED_PERMISSIONS.includes(p) || SALARY_TYPE_PERMISSIONS.includes(p)),
  );

  // Yordamchi o'qituvchi HECH QACHON guruh yarata OLMAYDI va guruh holatini
  // (activate/finish/jadval) o'zgartira OLMAYDI — bular faqat O'qituvchiga
  // xos imkoniyat. Route darajasida ham `requireGroupCreateAccess` /
  // `blockAssistantGroupUpdate` / `requireGroupScheduleAccess` bilan
  // bloklangan (group.routes.js), bu yerda esa saqlanadigan ma'lumot
  // darajasida kafolatlanadi.
  if (role === "assistant") {
    filtered = filtered.filter((p) => p !== "group:create" && p !== "group:update");
  }

  // Guruh yaratish/tahrirlash formasida fan tanlash SHART — `group:create`/
  // `group:update` bo'lsa, `subject:view` ham majburiy bo'lishi kerak
  // (frontend buni allaqachon qo'shadi, bu yerda backend darajasida
  // kafolatlanadi — API to'g'ridan-to'g'ri chaqirilsa ham buzilmasin).
  if (
    (filtered.includes("group:create") || filtered.includes("group:update")) &&
    !filtered.includes("subject:view")
  ) {
    filtered.push("subject:view");
  }

  return filtered;
};

module.exports = {
  TEACHING_ROLES,
  TEACHING_ALLOWED_PERMISSIONS,
  TEACHING_DENIED_PERMISSIONS,
  SALARY_TYPE_PERMISSIONS,
  STAFF_SALARY_TYPE_KEYS,
  SALARY_TYPE_TARIFF_FLAG,
  salaryTypeKeyOf,
  sanitizeStaffPermissions,
};
