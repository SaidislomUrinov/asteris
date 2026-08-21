const { Router } = require("express");
const systemSettingController = require("../controllers/systemSetting.controller");
const {
  adminAuth,
  fullAdminAuth,
  requirePermission,
} = require("../middlewares/authenticator.middleware");

const router = Router();

router.use(adminAuth, fullAdminAuth, requirePermission("settings:manage"));

router.get("/", systemSettingController.get);
router.patch("/", systemSettingController.update);

router.post("/test-smtp", systemSettingController.testSmtp);
router.post("/test-telegram", systemSettingController.testTelegram);

router.post("/backup/run", systemSettingController.runBackup);
router.get("/backup/list", systemSettingController.listBackups);

module.exports = router;
