const { Router } = require("express");
const teachingPlanController = require("../controllers/teachingPlan.controller");
const {
  tenantAuth,
  requireActiveSubscription,
  requireTenantPermission,
  requireTariffFeature,
} = require("../middlewares/authenticator.middleware");

const router = Router();

// "Dars rejalarim" — o'qituvchining shablon rejalari
// (API_CONTRACT_teaching_plans.md §4.1). Guruhga bog'lanmagan, shu sabab
// `teacherScope`/`requireTeacherGroup` kerak emas — egalik (`staff`) filtri
// servisda.
router.use(tenantAuth);
router.use(requireActiveSubscription);
router.use(requireTariffFeature("lesson.planning"));

// `/subjects` — `/:id` dan OLDIN (aks holda "subjects" id sifatida ushlanadi).
router.get("/subjects", requireTenantPermission("lesson:view"), teachingPlanController.subjects);
router.get("/", requireTenantPermission("lesson:view"), teachingPlanController.list);
// Excel import namunasi — `/:id` dan OLDIN (API_CONTRACT_teaching_plan_excel_import.md §1).
router.get(
  "/import-template",
  requireTenantPermission("lesson:create"),
  teachingPlanController.importTemplate,
);
router.get("/:id", requireTenantPermission("lesson:view"), teachingPlanController.getOne);
router.post("/", requireTenantPermission("lesson:create"), teachingPlanController.create);
router.put("/:id", requireTenantPermission("lesson:update"), teachingPlanController.update);
router.post(
  "/:id/duplicate",
  requireTenantPermission("lesson:create"),
  teachingPlanController.duplicate,
);
router.delete("/:id", requireTenantPermission("lesson:update"), teachingPlanController.remove);

module.exports = router;
