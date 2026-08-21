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

const router = Router();

router.use(tenantAuth);
router.use(requireActiveSubscription);
// O'qituvchi faqat O'Z guruhlarini ko'radi (ro'yxatlarga majburiy filtr).
router.use(teacherScope);

// ─── Ommaviy qayta tartiblash ("Tartiblash") ─────────────────────────────
// MUHIM: bu marshrutlar quyidagi `router.use("/:id", ...)` dan YUQORIDA
// turishi SHART. Aks holda "/reschedule/start" ham unga tushib,
// `req.params.id === "reschedule"` bo'lardi va requireCenterMatch
// `Group.findOne({ _id: "reschedule" })` da CastError berardi.
// API_CONTRACT_group_reschedule.md.
// Jadval sahifasining ma'lumot bazasi: guruhlar (hozirgi jadvali bilan) + xonalar.
// Joylashuvlar frontendda saqlanadi, shu sabab qoralama yozilmaydi.
router.get(
  "/schedule",
  blockTeachingRoles,
  requireTenantPermission("group:update"),
  groupController.scheduleData,
);
router.post(
  "/reschedule/start",
  blockTeachingRoles,
  requireTenantPermission("group:update"),
  groupController.rescheduleStart,
);
router.get(
  "/reschedule",
  blockTeachingRoles,
  requireTenantPermission("group:update"),
  groupController.rescheduleGet,
);
router.put(
  "/reschedule/place",
  blockTeachingRoles,
  requireTenantPermission("group:update"),
  groupController.reschedulePlace,
);
router.delete(
  "/reschedule/place/:groupId",
  blockTeachingRoles,
  requireTenantPermission("group:update"),
  groupController.rescheduleUnplace,
);
router.post(
  "/reschedule/commit",
  blockTeachingRoles,
  requireTenantPermission("group:update"),
  groupController.rescheduleCommit,
);
router.delete(
  "/reschedule",
  blockTeachingRoles,
  requireTenantPermission("group:update"),
  groupController.rescheduleDiscard,
);

// Staff boshqa filialning guruhini ID orqali ocha/tahrirlay olmaydi;
// o'qituvchi esa boshqa o'qituvchining guruhini ham ocha olmaydi.
router.use("/:id", requireCenterMatch(Group), requireTeacherGroup("id"));

router.post("/", blockTeachingRoles, requireTenantPermission("group:create"), groupController.create);
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
  blockTeachingRoles,
  requireTenantPermission("group:update"),
  groupController.activate,
);
router.patch(
  "/:id/schedule",
  blockTeachingRoles,
  blockTeachingRoles,
  requireTenantPermission("group:update"),
  groupController.reschedule,
);
router.patch(
  "/:id/finish",
  blockTeachingRoles,
  requireTenantPermission("group:update"),
  groupController.finish,
);

module.exports = router;
