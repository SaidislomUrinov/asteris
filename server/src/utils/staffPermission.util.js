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
  "student:view",
  "attendance:view",
  "attendance:create",
  "attendance:update",
  "lesson:view",
  "lesson:create",
  "lesson:update",
];

// Oylik hisoblash usuli ham `permissions` massivida saqlanadi, lekin bu
// "ruxsat" emas — o'qituvchi ham foizli/qat'iy/guruhli oylikda ishlashi
// mumkin, shuning uchun doiradan tashqarida bo'lsa ham saqlanadi.
// Hisobotlar (`report:*`) — MOLIYAVIY kesim (tushum, oylik, qarzdorlik,
// o'qituvchilar reytingi). O'qituvchi/yordamchi bu sahifaga umuman
// kirmaydi (API_CONTRACT.md §2.2). Quyidagi oq ro'yxatda yo'qligi allaqachon
// yetarli, lekin niyat ochiq ko'rinib turishi uchun alohida e'lon qilinadi
// va sanitize'da qo'shimcha to'siq sifatida ishlatiladi.
const TEACHING_DENIED_PERMISSIONS = ["report:view", "report:export"];

const SALARY_TYPE_PERMISSIONS = [
  "staff.salary.percentage",
  "staff.salary.fixed",
  "staff.salary.perGroup",
];

/**
 * Rolga mos kelmaydigan ruxsatlarni olib tashlaydi.
 * Xato tashlamaydi — rol o'zgartirilganda eski ruxsatlar jimgina tozalanishi
 * kerak (masalan resepshin -> o'qituvchi).
 */
const sanitizeStaffPermissions = (role, permissions) => {
  const list = Array.isArray(permissions) ? permissions : [];
  if (!TEACHING_ROLES.includes(role)) return list;

  return list.filter(
    (p) =>
      !TEACHING_DENIED_PERMISSIONS.includes(p) &&
      (TEACHING_ALLOWED_PERMISSIONS.includes(p) || SALARY_TYPE_PERMISSIONS.includes(p)),
  );
};

module.exports = {
  TEACHING_ROLES,
  TEACHING_ALLOWED_PERMISSIONS,
  TEACHING_DENIED_PERMISSIONS,
  SALARY_TYPE_PERMISSIONS,
  sanitizeStaffPermissions,
};
