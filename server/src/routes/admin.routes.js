const { Router } = require("express");
const rateLimit = require("express-rate-limit");
const adminController = require("../controllers/admin.controller");
const adminDashboardController = require("../controllers/adminDashboard.controller");
const {
  adminAuth,
  fullAdminAuth,
} = require("../middlewares/authenticator.middleware");

const router = Router();

// Brute-force himoyasi — bir IP'dan 15 daqiqada 10 martadan ko'p urinish rad etiladi.
const signInLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/signin", signInLimiter, adminController.signIn);
router.get("/verify", adminAuth, fullAdminAuth, adminController.verify);
router.get(
  "/dashboard",
  adminAuth,
  fullAdminAuth,
  adminDashboardController.get,
);
router.post("/refresh", adminAuth, fullAdminAuth, adminController.refresh);
router.post("/signout", adminAuth, fullAdminAuth, adminController.signOut);
router.patch(
  "/profile",
  adminAuth,
  fullAdminAuth,
  adminController.updateProfile,
);
router.get("/api-key", adminAuth, fullAdminAuth, adminController.getApiKey);
router.post(
  "/api-key/regenerate",
  adminAuth,
  fullAdminAuth,
  adminController.regenerateApiKey,
);

module.exports = router;
