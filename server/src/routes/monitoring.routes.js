const { Router } = require("express");
const monitoringController = require("../controllers/monitoring.controller");
const {
  adminAuth,
  fullAdminAuth,
  requirePermission,
} = require("../middlewares/authenticator.middleware");

const router = Router();

router.use(adminAuth, fullAdminAuth);

router.get("/", requirePermission("monitoring:view"), monitoringController.snapshot);
router.get("/history", requirePermission("monitoring:view"), monitoringController.history);

module.exports = router;
