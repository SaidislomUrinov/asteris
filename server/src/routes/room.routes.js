const { Router } = require("express");
const roomController = require("../controllers/room.controller");
const {
  tenantAuth,
  requireTenantPermission,
  requireTariffFeature,
  requireActiveSubscription,
  requireCenterMatch,
} = require("../middlewares/authenticator.middleware");
const Room = require("../models/Room");

const router = Router();

router.use(tenantAuth);
router.use(requireActiveSubscription);
// Staff boshqa filialning xonasini ID orqali ocha/tahrirlay olmaydi
router.use("/:id", requireCenterMatch(Room));

// `room.control` — FAQAT boshqaruv (yaratish/tahrirlash/o'chirish/detail
// sahifasi) uchun. Ro'yxat (`GET /`) ATAYLAB gate qilinmaydi — Guruh,
// Dashboard, Xodim kabi boshqa bir nechta sahifa xonalarni faqat LOOKUP
// (tanlov ro'yxati) sifatida ishlatadi, ularni tarifsiz sindirib qo'ymaslik
// uchun.
router.post(
  "/",
  requireTenantPermission("room:create"),
  requireTariffFeature("room.control"),
  roomController.create,
);
router.get("/", requireTenantPermission("room:view"), roomController.list);
// Xona TANLOVI uchun ruxsatsiz ro'yxat. `room:view` o'qituvchi/yordamchiga
// hech qachon berilmaydi (staffPermission.util.js whitelist'i), shu sabab
// ular guruhni faollashtirganda xonalar ro'yxati bo'sh kelardi. Bu endpoint
// faqat nom/filialni qaytaradi — Xona boshqaruvi baribir yopiq qoladi.
router.get("/lookup", roomController.lookup);
router.get(
  "/export",
  requireTenantPermission("room:view"),
  requireTariffFeature("room.control"),
  requireTariffFeature("excel.export"),
  roomController.exportList,
);
router.get(
  "/:id/export",
  requireTenantPermission("room:view"),
  requireTariffFeature("room.control"),
  requireTariffFeature("excel.export"),
  roomController.exportSchedule,
);
router.get(
  "/:id",
  requireTenantPermission("room:view"),
  requireTariffFeature("room.control"),
  roomController.getOne,
);
router.get("/:id/schedule", requireTenantPermission("room:view"), roomController.schedule);
router.patch(
  "/:id",
  requireTenantPermission("room:update"),
  requireTariffFeature("room.control"),
  roomController.update,
);
router.delete(
  "/:id",
  requireTenantPermission("room:delete"),
  requireTariffFeature("room.control"),
  roomController.remove,
);

module.exports = router;
