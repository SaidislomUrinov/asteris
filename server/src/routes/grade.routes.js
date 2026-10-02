const { Router } = require("express");
const gradeController = require("../controllers/grade.controller");
const {
  tenantAuth,
  requireActiveSubscription,
  requireTenantPermission,
  requireTeacherGroup,
  requireTariffFeature,
  teacherScope,
  requireStudentScope,
} = require("../middlewares/authenticator.middleware");

const router = Router();

router.use(tenantAuth);
router.use(requireActiveSubscription);
router.use(teacherScope);
router.use(requireTariffFeature("student.rate"));

// Baho — davomat bilan bir xil ruxsatlar doirasida: ko'rish `attendance:view`,
// qo'yish `attendance:create`. O'qituvchi faqat O'Z guruhida
// (`requireTeacherGroup`).
// O'quvchi baholari xulosasi (Student Detail) — `/:groupId` dan OLDIN,
// aks holda "summary" guruh id sifatida ushlanardi.
router.get(
  "/summary/:studentId",
  requireTenantPermission("attendance:view"),
  requireStudentScope(),
  gradeController.studentSummary,
);

router.get(
  "/:groupId",
  requireTenantPermission("attendance:view"),
  requireTeacherGroup(),
  gradeController.listByGroup,
);
router.get(
  "/:groupId/student/:studentId",
  requireTenantPermission("attendance:view"),
  requireTeacherGroup(),
  requireStudentScope(),
  gradeController.listByStudent,
);
router.post(
  "/:groupId",
  requireTenantPermission("attendance:create"),
  requireTeacherGroup(),
  gradeController.set,
);
router.delete(
  "/:groupId/:gradeId",
  requireTenantPermission("attendance:create"),
  requireTeacherGroup(),
  gradeController.remove,
);

module.exports = router;
