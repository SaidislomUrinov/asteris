// server/src/models/Tariff.js dagi allowedPermissions enum'iga mos kalitlar.
// Matnlar i18n'da (`tariffFeatures.*`, nuqta o'rniga `_` — i18next nuqtani
// ichma-ich kalit deb o'qiydi). Tariff modeliga yangi permission qo'shilsa
// shu ro'yxat, lang fayllari va admin/src/pages/Tariffs/permissionCatalog.js
// yangilanadi.
//
// Ro'yxatda YO'Q kalit (masalan olib tashlangan `staff.salary.perGroup`
// eski tarif hujjatida qolib ketgan bo'lsa) mijozga umuman ko'rsatilmaydi —
// xom kalit matni UI'ga chiqib qolmasligi uchun.
export const TARIFF_FEATURE_KEYS = [
  "excel.export",
  "telegram.notifications",
  "teacher.notifications",
  "teacher.performance",
  "staff.salary.advance",
  "staff.salary.percentage",
  "staff.salary.fixed",
  "staff.bonus",
  "student.rate",
  "student.transfer",
  "gamification.badges",
  "gamification.coins",
  "attendance.qr",
  "attendance.report",
  "room.control",
  "lesson.planning",
  "homework.manage",
  "certificate.manage",
  "receipt.manage",
  "finance.expense",
  "finance.refund",
  "finance.report",
  "ai.report",
  "ai.advice",
];

export const featureLabelKey = (key) => `tariffFeatures.${key.replaceAll(".", "_")}`;
