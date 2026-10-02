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
  "/:groupId",
  requireTenantPermission("attendance:view"),
  requireTeacherGroup(),
  homeworkController.listByGroup,
);
router.put(
  "/:groupId/:date",
  requireTenantPermission("attendance:create"),
  requireTeacherGroup(),
  homeworkController.set,
);

module.exports = router;
