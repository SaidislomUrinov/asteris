const { Router } = require("express");
const rateLimit = require("../utils/rateLimit.util");
const clientController = require("../controllers/client.controller");
const { clientAuth, fullClientAuth } = require("../middlewares/authenticator.middleware");

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

router.post("/signin", signInLimiter, clientController.signIn);
router.get("/verify", clientAuth, fullClientAuth, clientController.verify);
router.patch("/profile", profileLimiter, clientAuth, fullClientAuth, clientController.updateOwnProfile);
router.patch("/intro-seen", clientAuth, fullClientAuth, clientController.markIntroSeen);
router.post("/signout", clientAuth, fullClientAuth, clientController.signOutSession);
router.get("/tariffs", clientAuth, fullClientAuth, clientController.listTariffs);
router.post("/subscription/initiate", clientAuth, fullClientAuth, clientController.initiateSubscription);
router.get("/subscription/status/:orderId", clientAuth, fullClientAuth, clientController.subscriptionStatus);

module.exports = router;
