// server/src/models/Tariff.js dagi allowedPermissions enum ro'yxatiga mos —
// bular tarif orqali ochiladigan premium funksiyalar (feature flag), CRUD
// permission emas. Har modul ichida bir nechta feature bo'lishi mumkin.
// Matnlar lang fayllarida: modul nomi `tariff.modules.{module}`, feature
// nomi/izohi `tariff.features.{key nuqtalari "_" ga almashgan}.label|description`.
export const PERMISSION_CATALOG = [
  {
    module: "excel",
    items: [
      { key: "excel.export" },
    ],
  },
  {
    module: "telegram",
    items: [
      { key: "telegram.notifications" },
    ],
  },
  {
    module: "teacher",
    items: [
      { key: "teacher.notifications" },
      { key: "teacher.performance" },
    ],
  },
  {
    // Ish haqi — Menejer/Resepshin/O'qituvchi barchasiga tegishli (masalan
    // o'quvchi to'lovidan foiz: o'qituvchiga, resepshinga, menejerga alohida
    // ulush, qolgani markaz foydasi bo'lishi mumkin) — shuning uchun alohida,
    // rolga bog'liq bo'lmagan modul.
    module: "salary",
    items: [
      { key: "staff.salary.advance" },
      { key: "staff.salary.percentage" },
      { key: "staff.salary.fixed" },
      { key: "staff.bonus" },
    ],
  },
  {
    module: "student",
    items: [
      { key: "student.rate" },
      { key: "student.transfer" },
    ],
  },
  {
    // Oylik yutuq nishonlari — docs/API_CONTRACT_badges_monthly_rank.md §C.
    module: "gamification",
    items: [
      { key: "gamification.badges" },
      // WECOIN tangalari va filial do'koni — docs/API_CONTRACT_wecoin.md.
      { key: "gamification.coins" },
    ],
  },
  {
    module: "attendance",
    items: [
      { key: "attendance.qr" },
      { key: "attendance.report" },
    ],
  },
  {
    module: "room",
    items: [
      { key: "room.control" },
    ],
  },
  {
    module: "lesson",
    items: [
      { key: "lesson.planning" },
    ],
  },
  {
    module: "homework",
    items: [
      { key: "homework.manage" },
    ],
  },
  {
    module: "certificate",
    items: [
      { key: "certificate.manage" },
    ],
  },
  {
    module: "receipt",
    items: [
      { key: "receipt.manage" },
    ],
  },
  {
    module: "finance",
    items: [
      { key: "finance.expense" },
      { key: "finance.refund" },
      { key: "finance.report" },
    ],
  },
  // "ai" moduli (ai.report / ai.advice) vaqtincha katalogdan olib tashlangan
  // — bu funksiyalar hali qurilmagan (docs: tariff feature audit), production
  // relizga AI'siz chiqarilmoqda. Qayta qurilganda shu yerga qaytariladi.
];

export const featureI18nKey = (key) => `tariff.features.${key.replace(/\./g, "_")}`;

export const ALL_PERMISSIONS = PERMISSION_CATALOG.flatMap((m) => m.items.map((i) => i.key));
