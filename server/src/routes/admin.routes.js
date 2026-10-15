const { Router } = require("express");
const rateLimit = require("../utils/rateLimit.util");
const adminController = require("../controllers/admin.controller");
const adminDashboardController = require("../controllers/adminDashboard.controller");
const {
  adminAuth,
  fullAdminAuth,
  requirePermission,
} = require("../middlewares/authenticator.middleware");

const router = Router();

// Brute-force himoyasi, ikki qavat (Redis'da, barcha worker'lar uchun umumiy):
// 1) bitta HISOBGA bir IP'dan 15 daqiqada 10 urinish — parol tanlash to'xtaydi;
// 2) bitta IP'dan jami 60 urinish — ko'p hisobni aylanib "spray" qilish to'xtaydi.
// Avval faqat IP bo'yicha 10 edi: bitta NAT ortidagi markazda ertalab 10+
// hodim kirganda qolganlari bloklanib qolardi.
const accountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => `${rateLimit.ipKey(req)}:${String(req.body?.username || "").trim().toLowerCase().slice(0, 64)}`,
});
const ipLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60 });
const signInLimiter = [ipLimiter, accountLimiter];

// Refresh uchun alohida, kengroq limit (signin hisoblagichini yemasligi uchun).
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
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

router.post("/signin", signInLimiter, adminController.signIn);
router.get("/verify", adminAuth, fullAdminAuth, adminController.verify);
// Platforma daromadi va mijozlar statistikasi — `client:view` (avval har
// qanday admin, masalan faqat `monitoring:view` li ham ko'ra olardi).
router.get(
  "/dashboard",
  adminAuth,
  fullAdminAuth,
  requirePermission("client:view"),
  adminDashboardController.get,
);
// Access token 15 daqiqa yashaydi — u tugaganidan KEYIN yangilash kerak,
// shuning uchun `adminAuth` (access tekshiruvi) bu yerda bo'lmaydi: refresh
// JWT + Redis'dagi joriy refresh qiymati servisning o'zida tekshiriladi.
// Avval adminAuth ortida turgani uchun sessiya har 15 daqiqada uzilardi.
router.post("/refresh", refreshLimiter, adminController.refresh);
router.post("/signout", adminAuth, fullAdminAuth, adminController.signOut);
router.patch(
  "/profile",
  profileLimiter,
  adminAuth,
  fullAdminAuth,
  adminController.updateProfile,
);
// Lid API kaliti — tizim sozlamasi (`settings:manage`).
router.get("/api-key", adminAuth, fullAdminAuth, requirePermission("settings:manage"), adminController.getApiKey);
router.post(
  "/api-key/regenerate",
  adminAuth,
  fullAdminAuth,
  requirePermission("settings:manage"),
  adminController.regenerateApiKey,
);

module.exports = router;
