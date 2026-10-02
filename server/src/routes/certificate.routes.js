const { Router } = require("express");
const certificateController = require("../controllers/certificate.controller");
const {
  tenantAuth,
  requireTenantPermission,
  requireTariffFeature,
  requireActiveSubscription,
} = require("../middlewares/authenticator.middleware");

const router = Router();

router.use(tenantAuth);
router.use(requireActiveSubscription);
router.use(requireTariffFeature("certificate.manage"));

router.post(
  "/student/:studentId",
  requireTenantPermission("certificate:create"),
  certificateController.issueForStudent,
);
router.post(
  "/group/:groupId",
  requireTenantPermission("certificate:create"),
  certificateController.issueForGroup,
);
router.get(
  "/student/:studentId",
  requireTenantPermission("certificate:view"),
  certificateController.listForStudent,
);

module.exports = router;
