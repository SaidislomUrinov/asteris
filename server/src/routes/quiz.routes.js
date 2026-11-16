const { Router } = require("express");
const quizController = require("../controllers/quiz.controller");
const {
  tenantAuth,
  requireActiveSubscription,
  requireTenantPermission,
  requireTeacherGroup,
  requireTariffFeature,
  teacherScope,
} = require("../middlewares/authenticator.middleware");

// Test (Quiz) moduli (docs/API_CONTRACT_quiz.md) — `homework.routes.js` bilan
// bir xil zanjir, tarif flagi `quiz.manage`.
const router = Router();

router.use(tenantAuth);
router.use(requireActiveSubscription);
router.use(teacherScope);
router.use(requireTariffFeature("quiz.manage"));

router.get(
  "/:groupId",
  requireTenantPermission("attendance:view"),
  requireTeacherGroup(),
  quizController.listByGroup,
);
router.get(
  "/:groupId/:quizId",
  requireTenantPermission("attendance:view"),
  requireTeacherGroup(),
  quizController.detail,
);
router.post(
  "/:groupId/import",
  requireTenantPermission("attendance:create"),
  requireTeacherGroup(),
  quizController.importQuestions,
);
router.post(
  "/:groupId",
  requireTenantPermission("attendance:create"),
  requireTeacherGroup(),
  quizController.create,
);
router.put(
  "/:groupId/:quizId",
  requireTenantPermission("attendance:create"),
  requireTeacherGroup(),
  quizController.update,
);
router.delete(
  "/:groupId/:quizId",
  requireTenantPermission("attendance:create"),
  requireTeacherGroup(),
  quizController.remove,
);
router.put(
  "/:groupId/:quizId/attempts/:studentId/score",
  requireTenantPermission("attendance:create"),
  requireTeacherGroup(),
  quizController.setScore,
);

module.exports = router;
