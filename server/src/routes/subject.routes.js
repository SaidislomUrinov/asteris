const { Router } = require("express");
const subjectController = require("../controllers/subject.controller");
const {
  tenantAuth,
  requireTenantPermission,
  requireTariffFeature,
  requireActiveSubscription,
  requireCenterMatch,
} = require("../middlewares/authenticator.middleware");
const Subject = require("../models/Subject");

const router = Router();

// Client Owner yoki Staff (permission doirasida) — tenantAuth ikkalasini ham qabul qiladi
router.use(tenantAuth);
router.use(requireActiveSubscription);
// Staff boshqa filialning fanini ID orqali ocha/tahrirlay olmaydi
router.use("/:id", requireCenterMatch(Subject));

router.post("/", requireTenantPermission("subject:create"), subjectController.create);
router.get("/", requireTenantPermission("subject:view"), subjectController.list);
router.get(
  "/export",
  requireTenantPermission("subject:view"),
  requireTariffFeature("excel.export"),
  subjectController.exportList,
);
router.get("/:id", requireTenantPermission("subject:view"), subjectController.getOne);
router.patch("/:id", requireTenantPermission("subject:update"), subjectController.update);
router.delete("/:id", requireTenantPermission("subject:delete"), subjectController.remove);

module.exports = router;
