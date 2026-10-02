const { Router } = require("express");
const archiveController = require("../controllers/archive.controller");
const {
  tenantAuth,
  requireTenantPermission,
  requireActiveSubscription,
  requireOwner,
  blockTeachingRoles,
} = require("../middlewares/authenticator.middleware");

const router = Router();

router.use(tenantAuth);
router.use(requireActiveSubscription);
// Arxiv — Resepshin/Boshliq bo'limi. O'qituvchi va yordamchi o'qituvchi
// uchun butunlay yopiq (u yerda qarzdorlik va hodim ma'lumoti bor).
router.use(blockTeachingRoles);

const canView = requireTenantPermission("archive:view");
const canRestore = requireTenantPermission("archive:restore");

// ─── Ro'yxatlar ───────────────────────────────────────────────────────────
router.get("/counts", canView, archiveController.counts);
router.get("/groups", canView, archiveController.groups);
router.get("/students", canView, archiveController.students);
router.get("/rooms", canView, archiveController.rooms);
router.get("/subjects", canView, archiveController.subjects);
router.get("/teaching-plans", canView, archiveController.teachingPlans);
// Hodim arxivi — faqat Boshliq. Resepshin hodimni arxivlay ham olmaydi
// (`/staffs` allaqachon `clientAuth`), ko'ra ham olmaydi.
router.get("/staff", requireOwner, archiveController.staff);

// ─── Qaytarish ────────────────────────────────────────────────────────────
router.patch("/groups/:id/restore", canRestore, archiveController.restoreGroup);
router.patch("/rooms/:id/restore", canRestore, archiveController.restoreRoom);
router.patch("/subjects/:id/restore", canRestore, archiveController.restoreSubject);
router.patch("/teaching-plans/:id/restore", canRestore, archiveController.restoreTeachingPlan);
router.patch("/staff/:id/restore", requireOwner, archiveController.restoreStaff);
router.patch(
  "/students/:studentId/entries/:entryId/restore",
  canRestore,
  archiveController.restoreStudentEntry,
);

module.exports = router;
