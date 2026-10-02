const { Router } = require("express");
const certificateTemplateController = require("../controllers/certificateTemplate.controller");
const {
  tenantAuth,
  requireTenantPermission,
  requireTariffFeature,
  requireActiveSubscription,
  requireCenterMatch,
} = require("../middlewares/authenticator.middleware");
const CertificateTemplate = require("../models/CertificateTemplate");

const router = Router();

router.use(tenantAuth);
router.use(requireActiveSubscription);
router.use(requireTariffFeature("certificate.manage"));
// Staff boshqa filialning shablonini ID orqali ocha/tahrirlay olmaydi.
router.use("/:id", requireCenterMatch(CertificateTemplate));

router.post("/", requireTenantPermission("certificate:create"), certificateTemplateController.create);
router.get("/", requireTenantPermission("certificate:view"), certificateTemplateController.list);
router.get("/:id", requireTenantPermission("certificate:view"), certificateTemplateController.getOne);
router.patch("/:id", requireTenantPermission("certificate:update"), certificateTemplateController.update);
router.delete("/:id", requireTenantPermission("certificate:delete"), certificateTemplateController.remove);

module.exports = router;
