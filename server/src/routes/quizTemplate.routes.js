const { Router } = require("express");
const quizTemplateController = require("../controllers/quizTemplate.controller");
const {
  tenantAuth,
  requireActiveSubscription,
  requireTenantPermission,
  requireTariffFeature,
  teacherScope,
} = require("../middlewares/authenticator.middleware");

// TEST SHABLONLARI (QuizTemplate) — docs/API_CONTRACT_quiz_templates.md.
// Guruhga bog'lanmagan (fanga bog'langan), shu sabab `requireTeacherGroup`
// kerak emas — egalik (`staff`) filtri servisda. Tarif flagi `quiz.manage`
// (yangisi qo'shilmagan), permissionlar `attendance:view`/`attendance:create`
// (quiz.routes.js bilan muvofiqlik uchun saqlangan).
const router = Router();

router.use(tenantAuth);
router.use(requireActiveSubscription);
router.use(teacherScope);
router.use(requireTariffFeature("quiz.manage"));

router.get("/", requireTenantPermission("attendance:view"), quizTemplateController.list);
router.get("/:id", requireTenantPermission("attendance:view"), quizTemplateController.getOne);
router.post("/", requireTenantPermission("attendance:create"), quizTemplateController.create);
router.put("/:id", requireTenantPermission("attendance:create"), quizTemplateController.update);
router.delete("/:id", requireTenantPermission("attendance:create"), quizTemplateController.remove);
router.post(
  "/:id/send",
  requireTenantPermission("attendance:create"),
  quizTemplateController.send,
);

module.exports = router;
