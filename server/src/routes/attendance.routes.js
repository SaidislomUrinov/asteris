const { Router } = require("express");
const attendanceController = require("../controllers/attendance.controller");
const {
  tenantAuth,
  requireTenantPermission,
  requireActiveSubscription,
  requireTariffFeature,
  requireTeacherGroup,
  requireOwnCenterParam,
  requireStudentScope,
} = require("../middlewares/authenticator.middleware");

const router = Router();

router.use(tenantAuth);
router.use(requireActiveSubscription);

// Hodim faqat O'Z filiali sozlamalarini (boshqa filialniki — auth.forbidden).
router.get("/settings/:centerId", requireTenantPermission("attendance:view"), requireOwnCenterParam(), attendanceController.getSettings);
router.patch("/settings/:centerId", requireTenantPermission("settings:update"), requireOwnCenterParam(), attendanceController.updateSettings);
// QR davomat — premium, tarif flagi ostida (`attendance.qr`). `/:groupId`
// dan OLDIN e'lon qilinadi, aks holda "qr" guruh id sifatida ushlanadi.
router.get(
  "/qr/group/:groupId",
  requireTariffFeature("attendance.qr"),
  requireTenantPermission("attendance:view"),
  requireTeacherGroup(),
  attendanceController.getGroupQrCards,
);
router.get(
  "/qr/:studentId",
  requireTariffFeature("attendance.qr"),
  requireTenantPermission("attendance:view"),
  requireStudentScope(),
  attendanceController.getQrToken,
);
// QR kartani Telegramga yuborish — GET `/qr/:studentId` bilan BIR XIL himoya
// (API_CONTRACT_qr_card_send_and_worker_chat.md §A.2).
router.post(
  "/qr/:studentId/send",
  requireTariffFeature("attendance.qr"),
  requireTenantPermission("attendance:view"),
  requireStudentScope(),
  attendanceController.sendQrCard,
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

// "O'quvchilar" ro'yxatini baho/davomat bo'yicha tartiblash uchun —
// API_CONTRACT_group_students_sort.md.
router.get(
  "/:groupId/summary",
  requireTenantPermission("attendance:view"),
  requireTeacherGroup(),
  attendanceController.getStudentsSummary,
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
  requireStudentScope(),
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
