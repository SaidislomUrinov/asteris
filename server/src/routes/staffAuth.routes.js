const { Router } = require("express");
const rateLimit = require("../utils/rateLimit.util");
const staffController = require("../controllers/staff.controller");
const { staffAuth, fullStaffAuth } = require("../middlewares/authenticator.middleware");

const router = Router();

// Brute-force himoyasi — bir IP'dan 15 daqiqada 10 martadan ko'p urinish rad etiladi.
const signInLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

// Profil (parol almashtirish `currentPassword` bilan) — parolni tanlab
// ko'rishdan himoya; signin hisoblagichidan alohida.
const profileLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/signin", signInLimiter, staffController.signIn);
router.get("/verify", staffAuth, fullStaffAuth, staffController.verify);
router.post("/signout", staffAuth, fullStaffAuth, staffController.signOutSession);
router.patch("/profile", profileLimiter, staffAuth, fullStaffAuth, staffController.updateOwnProfile);
router.patch("/intro-seen", staffAuth, fullStaffAuth, staffController.markIntroSeen);

module.exports = router;
