const { Router } = require("express");
const smsController = require("../controllers/sms.controller");
const { adminAuth, fullAdminAuth, requirePermission } = require("../middlewares/authenticator.middleware");

const router = Router();

router.use(adminAuth, fullAdminAuth, requirePermission("settings:manage"));

router.get("/templates", smsController.adminTemplates);
router.post("/templates", smsController.adminCreateTemplate);
router.put("/templates/:id", smsController.adminUpdateTemplate);
router.delete("/templates/:id", smsController.adminRemoveTemplate);
router.get("/batches", smsController.adminBatches);
router.get("/batches/:id", smsController.adminBatchDetail);
router.get("/packages", smsController.adminPackages);
router.post("/packages", smsController.adminCreatePackage);
router.put("/packages/:id", smsController.adminUpdatePackage);
router.delete("/packages/:id", smsController.adminRemovePackage);
router.get("/stats", smsController.adminStats);
router.put("/stats", smsController.adminUpdateStats);
router.get("/purchases", smsController.adminPurchases);
router.get("/clients/:id/centers", smsController.adminClientCenters);
router.post("/grant", smsController.adminGrant);
router.post("/test", smsController.adminTest);
router.get("/test/:id", smsController.adminTestStatus);

module.exports = router;
