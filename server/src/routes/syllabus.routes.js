const { Router } = require("express");
const syllabusController = require("../controllers/syllabus.controller");
const {
  tenantAuth,
  requireActiveSubscription,
  requireTenantPermission,
  requireTeacherGroup,
  teacherScope,
} = require("../middlewares/authenticator.middleware");

const router = Router();

router.use(tenantAuth);
router.use(requireActiveSubscription);
router.use(teacherScope);

// Kurs dasturi — CLAUDE.md permission jadvalidagi "Dars rejalari" guruhi
// (`lesson:*`), eski LessonPlan moduli o'rnini bosadi. O'qituvchi o'z
// guruhining dasturini tuzadi; `requireTeacherGroup` ID orqali begona
// guruhga murojaatni yopadi.
router.get(
  "/:groupId",
  requireTenantPermission("lesson:view"),
  requireTeacherGroup(),
  syllabusController.get,
);
router.put(
  "/:groupId",
  requireTenantPermission("lesson:update"),
  requireTeacherGroup(),
  syllabusController.save,
);
router.patch(
  "/:groupId/offset",
  requireTenantPermission("lesson:update"),
  requireTeacherGroup(),
  syllabusController.setOffset,
);
router.get(
  "/:groupId/sources",
  requireTenantPermission("lesson:view"),
  requireTeacherGroup(),
  syllabusController.sources,
);
router.post(
  "/:groupId/import",
  requireTenantPermission("lesson:create"),
  requireTeacherGroup(),
  syllabusController.importFrom,
);

module.exports = router;
