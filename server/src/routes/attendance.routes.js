const { Router } = require("express");
const attendanceController = require("../controllers/attendance.controller");
const {
  tenantAuth,
  requireTenantPermission,
  requireActiveSubscription,
  requireTariffFeature,
  requireTeacherGroup,
} = require("../middlewares/authenticator.middleware");

const router = Router();

router.use(tenantAuth);
router.use(requireActiveSubscription);

router.get("/settings/:centerId", requireTenantPermission("attendance:view"), attendanceController.getSettings);
router.patch("/settings/:centerId", requireTenantPermission("settings:update"), attendanceController.updateSettings);
// QR davomat — premium, tarif flagi ostida (`attendance.qr`). `/:groupId`
// dan OLDIN e'lon qilinadi, aks holda "qr" guruh id sifatida ushlanadi.
router.get(
  "/qr/:studentId",
  requireTariffFeature("attendance.qr"),
  requireTenantPermission("attendance:view"),
  attendanceController.getQrToken,
);
router.post(
  "/qr/scan",
  requireTariffFeature("attendance.qr"),
  requireTenantPermission("attendance:create"),
  attendanceController.scanQr,
);

router.get(
  "/:groupId/stats",
  requireTenantPermission("attendance:view"),
  requireTeacherGroup(),
  attendanceController.getStats,
);
router.get(
  "/:groupId/month",
  requireTenantPermission("attendance:view"),
  requireTeacherGroup(),
  attendanceController.getMonth,
);
router.get(
  "/:groupId/student/:studentId",
  requireTenantPermission("attendance:view"),
  requireTeacherGroup(),
  attendanceController.getStudentHistory,
);
router.get(
  "/:groupId",
  requireTenantPermission("attendance:view"),
  requireTeacherGroup(),
  attendanceController.getToday,
);
router.post(
  "/:groupId/mark",
  requireTenantPermission("attendance:create"),
  requireTeacherGroup(),
  attendanceController.mark,
);

module.exports = router;
