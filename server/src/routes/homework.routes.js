const { Router } = require("express");
const homeworkController = require("../controllers/homework.controller");
const {
  tenantAuth,
  requireActiveSubscription,
  requireTenantPermission,
  requireTeacherGroup,
  requireTariffFeature,
  teacherScope,
} = require("../middlewares/authenticator.middleware");

// Uyga vazifa (API_CONTRACT_student_role_homework.md §4) — zanjir
// `grade.routes.js` bilan bir xil, tarif flagi `homework.manage`.
const router = Router();

router.use(tenantAuth);
router.use(requireActiveSubscription);
router.use(teacherScope);
router.use(requireTariffFeature("homework.manage"));

router.get(
  "/:groupId/latest",
  requireTenantPermission("attendance:view"),
  requireTeacherGroup(),
  homeworkController.latestByGroup,
);
router.get(
  "/:groupId",
  requireTenantPermission("attendance:view"),
  requireTeacherGroup(),
  homeworkController.listByGroup,
);
// Natijalar (API_CONTRACT_wecoin.md §2.2) — `/:groupId/:date` dan OLDIN.
router.put(
  "/:groupId/:date/results",
  requireTenantPermission("attendance:create"),
  requireTeacherGroup(),
  homeworkController.setResults,
);
router.put(
  "/:groupId/:date",
  requireTenantPermission("attendance:create"),
  requireTeacherGroup(),
  homeworkController.set,
);

module.exports = router;
