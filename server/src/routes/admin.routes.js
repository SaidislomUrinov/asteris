const { Router } = require("express");
const adminController = require("../controllers/admin.controller");
const {
  adminAuth,
  fullAdminAuth,
} = require("../middlewares/authenticator.middleware");

const router = Router();

router.post("/signin", adminController.signIn);
router.get("/verify", adminAuth, fullAdminAuth, adminController.verify);
router.post("/refresh", adminAuth, fullAdminAuth, adminController.refresh);
router.post("/signout", adminAuth, fullAdminAuth, adminController.signOut);
router.get("/api-key", adminAuth, fullAdminAuth, adminController.getApiKey);
router.post(
  "/api-key/regenerate",
  adminAuth,
  fullAdminAuth,
  adminController.regenerateApiKey,
);

module.exports = router;
