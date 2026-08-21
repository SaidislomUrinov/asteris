const { Router } = require("express");
const adminAuditController = require("../controllers/adminAudit.controller");
const {
  adminAuth,
  fullAdminAuth,
  requirePermission,
} = require("../middlewares/authenticator.middleware");

const router = Router();

// Cross-tenant audit jurnali — `admin.routes.js` dan ALOHIDA fayl:
// "bitta domen = bitta zanjir" qoidasi bo'yicha audit o'z routes/controller
// juftligiga ega, admin auth zanjiri esa o'zining faylida qoladi.
router.use(adminAuth);
router.use(fullAdminAuth);
router.use(requirePermission("audit:view"));

router.get("/", adminAuditController.list);
router.get("/filters", adminAuditController.filters);
router.get("/export", adminAuditController.exportList);

module.exports = router;
