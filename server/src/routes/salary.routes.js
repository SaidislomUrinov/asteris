const { Router } = require("express");
const salaryController = require("../controllers/salary.controller");
const {
  tenantAuth,
  requireTenantPermission,
  requireTariffFeature,
  requireActiveSubscription,
} = require("../middlewares/authenticator.middleware");

const router = Router();

router.use(tenantAuth);
router.use(requireActiveSubscription);

// Umumiy xulosa — faqat salary:view permission (owner/manager avtomatik o'tadi)
router.get("/summary", requireTenantPermission("salary:view"), salaryController.summary);
router.get(
  "/summary/export",
  requireTenantPermission("salary:view"),
  requireTariffFeature("excel.export"),
  salaryController.exportSummary,
);
router.get(
  "/:staffId/export",
  requireTariffFeature("excel.export"),
  salaryController.exportOne,
);
// Hodim O'Z hisobini permission'siz ham ko'ra oladi (controller cheklaydi)
router.get("/:staffId", salaryController.detail);
router.post(
  "/:staffId/transactions",
  requireTenantPermission("salary:manage"),
  salaryController.addTransaction,
);
router.patch(
  "/transactions/:txId/cancel",
  requireTenantPermission("salary:manage"),
  salaryController.cancelTransaction,
);

module.exports = router;
