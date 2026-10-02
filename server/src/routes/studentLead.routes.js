const { Router } = require("express");
const studentLeadController = require("../controllers/studentLead.controller");
const {
  tenantAuth,
  requireTenantPermission,
  requireActiveSubscription,
  requireCenterMatch,
  blockTeachingRoles,
} = require("../middlewares/authenticator.middleware");
const StudentLead = require("../models/StudentLead");

// API_CONTRACT_student_leads.md — lidlar Boshliq va Resepshin/Menejer ishi,
// o'qituvchi rollariga umuman yopiq.
const router = Router();

// Enroll bir nechta modulga tegadi: lidni yopadi, o'quvchi yaratadi va
// (yangi guruh bo'lsa) guruh yaratib aktivlashtiradi — har biriga o'z ruxsati.
const requireEnrollAccess = (req, res, next) => {
  const needed = ["lead:update", "student:create"];
  if (req.body?.target === "new") needed.push("group:create", "group:update");
  const check = (i) => {
    if (i >= needed.length) return next();
    requireTenantPermission(needed[i])(req, res, (err) => (err ? next(err) : check(i + 1)));
  };
  check(0);
};

router.use(tenantAuth);
router.use(blockTeachingRoles);
router.use(requireActiveSubscription);

router.get("/", requireTenantPermission("lead:view"), studentLeadController.list);
router.get("/stats", requireTenantPermission("lead:view"), studentLeadController.monthStats);
router.get("/summary", requireTenantPermission("lead:view"), studentLeadController.summary);
router.post("/", requireTenantPermission("lead:create"), studentLeadController.create);
router.post("/enroll", requireEnrollAccess, studentLeadController.enroll);

router.use("/:id", requireCenterMatch(StudentLead));
router.patch("/:id", requireTenantPermission("lead:update"), studentLeadController.update);
router.delete("/:id", requireTenantPermission("lead:delete"), studentLeadController.remove);

module.exports = router;
