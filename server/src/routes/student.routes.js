const { Router } = require("express");
const studentController = require("../controllers/student.controller");
const {
  tenantAuth,
  requireTenantPermission,
  requireTariffFeature,
  requireActiveSubscription,
  requireOwner,
  blockTeachingRoles,
} = require("../middlewares/authenticator.middleware");

const Group = require("../models/Group");

// Guruhga biriktirilish orqali cheklanadigan rollar → Group'dagi maydon
// nomi (authenticator.middleware.js dagi GROUP_SCOPE_FIELD bilan bir xil).
// Avval bu yerda faqat "teacher" tekshirilardi — yordamchi o'qituvchi
// cheklovlardan butunlay chetda qolardi.
const GROUP_SCOPE_FIELD = { teacher: "teacher", assistant: "assistant" };

// O'qituvchi/yordamchi BARCHA o'quvchilar ro'yxatini ola olmaydi — faqat O'Z
// guruhi bo'yicha (`?group=<id>`). Filial izolyatsiyasi yetarli emas: bitta
// filialda bir nechta o'qituvchi bor.
const teacherStudentScope = async (req, res, next) => {
  const field = GROUP_SCOPE_FIELD[req.staff?.role];
  if (!field) return next();
  try {
    const groupId = req.query.group;
    if (!groupId) throw new Error("auth.forbidden");
    const group = await Group.findOne({
      _id: groupId,
      client: req.client._id,
      [field]: req.staff._id,
      isDeleted: false,
    }).select("_id");
    if (!group) throw new Error("auth.forbidden");
    next();
  } catch (error) {
    next(error);
  }
};

// `blockTeachingRoles` — authenticator.middleware.js dan (avval shu faylda
// nusxasi bor edi; endi guruh marshrutlari ham o'shanga tayangani uchun
// yagona joyga ko'chirildi). O'quvchining BATAFSIL kartochkasi o'qituvchi
// rollariga umuman ochilmaydi (docs/teacher-scope-updates.md §3) — u yerda
// to'lov tarixi va qarzdorlik bor. Guruh sahifasidagi ro'yxat va davomat
// ularga yetarli.

const router = Router();

router.use(tenantAuth);
router.use(requireActiveSubscription);

router.post("/", requireTenantPermission("student:create"), studentController.create);
router.get(
  "/",
  requireTenantPermission("student:view"),
  teacherStudentScope,
  studentController.list,
);
router.get("/lookup", requireTenantPermission("student:view"), studentController.lookupByPhone);
router.get(
  "/export",
  blockTeachingRoles,
  requireTenantPermission("student:view"),
  requireTariffFeature("excel.export"),
  studentController.exportList,
);
// "Tushumlar" — faqat Client Owner ko'radi (har tranzaksiyani kim
// olganini ko'rsatadi). `/:id` dan OLDIN e'lon qilinadi.
router.get("/revenue", requireOwner, studentController.listRevenue);
router.get(
  "/revenue/export",
  requireOwner,
  requireTariffFeature("excel.export"),
  studentController.exportRevenue,
);
router.get(
  "/:id/export",
  blockTeachingRoles,
  requireTenantPermission("student:view"),
  requireTariffFeature("excel.export"),
  studentController.exportOne,
);
router.get(
  "/:id",
  requireTenantPermission("student:view"),
  blockTeachingRoles,
  studentController.getOne,
);
router.patch(
  "/:id",
  blockTeachingRoles,
  requireTenantPermission("student:update"),
  studentController.update,
);
router.patch(
  "/:id/groups/:groupEntryId",
  requireTenantPermission("student:update"),
  studentController.updateGroupPrice,
);
// O'quvchini guruhdan chiqarish — Resepshin/Boshliq ishi. O'qituvchi va
// yordamchi o'qituvchi uchun ROL darajasida yopiq (ruxsat ro'yxati ham
// `student:update` ni ularga bermaydi, bu ikkinchi qatlam).
router.patch(
  "/:id/groups/:groupEntryId/leave",
  blockTeachingRoles,
  requireTenantPermission("student:update"),
  studentController.leaveGroup,
);
router.post(
  "/:id/groups/:groupEntryId/payments",
  blockTeachingRoles,
  requireTenantPermission("payment:create"),
  studentController.addPayment,
);
router.patch(
  "/:id/groups/:groupEntryId/payments/:paymentId/cancel",
  blockTeachingRoles,
  requireTenantPermission("payment:refund"),
  studentController.cancelPayment,
);

module.exports = router;
