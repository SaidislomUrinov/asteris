const { Router } = require("express");
const smsController = require("../controllers/sms.controller");
const {
  tenantAuth,
  requireTenantPermission,
  requireTariffFeature,
  requireActiveSubscription,
  requireOwner,
} = require("../middlewares/authenticator.middleware");

const router = Router();

router.use(tenantAuth);
router.use(requireActiveSubscription);
router.use(requireTariffFeature("sms.notification"));

router.get("/templates", requireTenantPermission("sms:view"), smsController.templates);
router.get("/summary", requireTenantPermission("sms:view"), smsController.summary);
router.get("/batches", requireTenantPermission("sms:view"), smsController.batches);
router.get("/batches/:id", requireTenantPermission("sms:view"), smsController.batchDetail);
router.post("/batches/:id/refresh", requireTenantPermission("sms:view"), smsController.refreshBatch);
router.get("/packages", requireTenantPermission("sms:view"), smsController.packages);
router.post("/packages/:id/buy", requireOwner, smsController.buy);
router.get("/purchases/:orderId/status", requireOwner, smsController.purchaseStatus);
router.get("/purchases", requireTenantPermission("sms:view"), smsController.purchases);
router.get("/transactions", requireTenantPermission("sms:view"), smsController.transactions);
router.post("/preview", requireTenantPermission("sms:send"), smsController.preview);
router.post("/send", requireTenantPermission("sms:send"), smsController.send);

module.exports = router;
