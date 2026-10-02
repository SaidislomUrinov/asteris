const { Router } = require("express");
const serverLogController = require("../controllers/serverLog.controller");
const {
  adminAuth,
  fullAdminAuth,
  requirePermission,
} = require("../middlewares/authenticator.middleware");

const router = Router();

// Server loglari — texnik holat, shuning uchun Monitoring bilan bir xil ruxsat.
router.use(adminAuth, fullAdminAuth, requirePermission("monitoring:view"));

router.get("/files", serverLogController.files);
router.get("/", serverLogController.tail);
router.get("/download", serverLogController.download);

module.exports = router;
