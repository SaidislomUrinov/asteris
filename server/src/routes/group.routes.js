const { Router } = require("express");
const groupController = require("../controllers/group.controller");
const {
  tenantAuth,
  requireTenantPermission,
  requireTariffFeature,
  requireActiveSubscription,
  requireCenterMatch,
  requireTeacherGroup,
  teacherScope,
  blockTeachingRoles,
} = require("../middlewares/authenticator.middleware");
const Group = require("../models/Group");

// Guruh Excel eksporti — o'quvchilar narxi/to'lovi bilan keladi, shuning
// uchun o'qituvchiga yopiq (u moliyaviy ma'lumot ko'rmaydi).
const blockTeacher = (req, res, next) =>
  req.staff?.role === "teacher" ? next(new Error("auth.forbidden")) : next();

// Guruh nomini tahrirlash — Yordamchi o'qituvchidan BOSHQA hamma (Boshliq,
// Markaz menejeri, Resepshin, O'qituvchi) tahrirlay oladi. O'qituvchi odatda
// `group:update` ruxsatiga ega bo'lmaydi (TEACHING_ALLOWED_PERMISSIONS —
// staffPermission.util.js), shu sabab bu yerda alohida: Yordamchi qat'iy
// bloklanadi, O'qituvchiga esa granular ruxsatdan qat'i nazar ruxsat
// beriladi; Menejer/Resepshin uchun boshqa guruh amallari bilan bir xil
// `group:update` tarif ruxsati talab qilinadi.
const requireGroupRenameAccess = (req, res, next) => {
  if (!req.staff) return next(); // Client Owner
  if (req.staff.role === "assistant") return next(new Error("auth.forbidden"));
  if (req.staff.role === "teacher") return next();
  return requireTenantPermission("group:update")(req, res, next);
};

// Guruh yaratish — O'qituvchiga `group:create` ruxsati berilishi mumkin
// (o'zini guruhini yaratadi), lekin Yordamchi o'qituvchi HECH QACHON guruh
// yarata olmaydi — permission berilgan bo'lsa ham qat'iy bloklanadi (Hodim
// oynasida ham shu checkbox unga umuman ko'rsatilmaydi).
const requireGroupCreateAccess = (req, res, next) => {
  if (req.staff?.role === "assistant") return next(new Error("auth.forbidden"));
  return requireTenantPermission("group:create")(req, res, next);
};

// Yordamchi o'qituvchi guruh holatini (activate/finish) HECH QACHON
// o'zgartira olmaydi — `group:update` berilgan bo'lsa ham. Menejer/Resepshin/
// Boshliq uchun odatdagidek `group:update` tarif ruxsati talab qilinadi.
const blockAssistantGroupUpdate = (req, res, next) =>
  req.staff?.role === "assistant" ? next(new Error("auth.forbidden")) : next();

// Guruh jadvalini tahrirlash (`PATCH /:id/schedule`) — uchta doira:
// 1) Yordamchi o'qituvchi — qat'iy bloklangan.
// 2) O'qituvchi — o'ZINING guruhi uchun (`requireTeacherGroup` allaqachon
//    tekshiradi) HAR DOIM ruxsat beriladi, lekin FAQAT yordamchi o'qituvchi
//    maydonini o'zgartira oladi — boshqa maydonlar (fan, xona, kunlar, vaqt)
//    `group.service.js#reschedule`da backend darajasida e'tiborga olinmaydi
//    (frontend ham GroupScheduleDialog'da bu maydonlarni qulflab qo'yadi).
// 3) Menejer/Resepshin/Boshliq — to'liq tahrirlash, odatdagidek `group:update`
//    tarif ruxsati bilan.
const requireGroupScheduleAccess = (req, res, next) => {
  if (req.staff?.role === "assistant") return next(new Error("auth.forbidden"));
  if (req.staff?.role === "teacher") return next();
  return requireTenantPermission("group:update")(req, res, next);
};

// Individual o'quvchi (API_CONTRACT_individual_students.md §2) — faqat
// Boshliq va Resepshin/Menejer: O'qituvchi/Yordamchi rol bo'yicha qat'iy
// bloklanadi (ular faqat ko'radi va dars o'tadi), qolganlarga granular ruxsat.
const requireIndividualAccess = (permission) => (req, res, next) => {
  if (!req.staff) return next(); // Client Owner
  if (["teacher", "assistant"].includes(req.staff.role)) return next(new Error("auth.forbidden"));
  return requireTenantPermission(permission)(req, res, next);
};

const router = Router();

router.use(tenantAuth);
router.use(requireActiveSubscription);
// O'qituvchi faqat O'Z guruhlarini ko'radi (ro'yxatlarga majburiy filtr).
router.use(teacherScope);

// ─── Jadval sahifasi — ma'lumot bazasi ───────────────────────────────────
// MUHIM: bu marshrut quyidagi `router.use("/:id", ...)` dan YUQORIDA turishi
// SHART, aks holda "/schedule" ham unga tushib, `req.params.id === "schedule"`
// bo'lardi va requireCenterMatch `Group.findOne({ _id: "schedule" })` da
// CastError berardi.
// Jadval sahifasining ma'lumot bazasi: guruhlar (hozirgi jadvali bilan) + xonalar.
// Saqlash esa har bir guruh uchun alohida `PATCH /:id/schedule` orqali boradi
// (API_CONTRACT_group_schedule_per_group.md) — bulk/qoralama oqim yo'q.
router.get(
  "/schedule",
  blockTeachingRoles,
  requireTenantPermission("group:update"),
  groupController.scheduleData,
);

// Staff boshqa filialning guruhini ID orqali ocha/tahrirlay olmaydi;
// o'qituvchi esa boshqa o'qituvchining guruhini ham ocha olmaydi.
router.use("/:id", requireCenterMatch(Group), requireTeacherGroup("id"));

router.post("/", requireGroupCreateAccess, groupController.create);
// "/individual" — ObjectId emas, shu sabab yuqoridagi `/:id` guard'lari
// uni chetlab o'tadi (isValidObjectId tekshiruvi).
router.post("/individual", requireIndividualAccess("student:create"), groupController.createIndividual);
router.get("/", requireTenantPermission("group:view"), groupController.list);
router.get(
  "/export",
  blockTeacher,
  requireTenantPermission("group:view"),
  requireTariffFeature("excel.export"),
  groupController.exportList,
);
router.get(
  "/:id/export",
  blockTeacher,
  requireTenantPermission("group:view"),
  requireTariffFeature("excel.export"),
  groupController.exportOne,
);
router.get("/:id", requireTenantPermission("group:view"), groupController.getOne);
router.patch(
  "/:id/activate",
  blockAssistantGroupUpdate,
  requireTenantPermission("group:update"),
  groupController.activate,
);
router.patch(
  "/:id/schedule",
  requireGroupScheduleAccess,
  groupController.reschedule,
);
router.patch(
  "/:id/finish",
  blockAssistantGroupUpdate,
  requireTenantPermission("group:update"),
  groupController.finish,
);
router.patch("/:id/individual", requireIndividualAccess("group:update"), groupController.updateIndividual);
router.patch("/:id/rename", requireGroupRenameAccess, groupController.rename);
// Telegram guruh manzili — nom tahriri bilan bir xil doira (Yordamchidan boshqa hamma).
router.patch("/:id/telegram", requireGroupRenameAccess, groupController.setTelegramLink);
// Arxivlash — "o'chirish" O'RNIGA (API_CONTRACT_archive.md). O'qituvchi va
// yordamchi o'qituvchi uchun yopiq: arxiv Resepshin/Boshliq ishi.
router.delete(
  "/:id",
  blockTeachingRoles,
  requireTenantPermission("group:delete"),
  groupController.archive,
);

module.exports = router;
