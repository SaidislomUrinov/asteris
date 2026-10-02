const { Router } = require("express");
const fontController = require("../controllers/font.controller");
const {
  adminAuth,
  fullAdminAuth,
  requirePermission,
} = require("../middlewares/authenticator.middleware");

const router = Router();

// `GET /` ATAYLAB ochiq — sertifikat konstruktori (Client/Staff) va
// PDF generatsiya (browser, `certificatePdf.util.js`) shrift ro'yxati va
// fayllariga tenantAuth'siz murojaat qiladi (shrift fayli maxfiy emas,
// bir xil `/health` kabi ochiq resurs). Faqat yuklash/o'chirish Platform
// Admin uchun cheklanadi.
router.get("/", fontController.list);
router.post("/", adminAuth, fullAdminAuth, requirePermission("settings:manage"), fontController.create);
router.delete(
  "/:id",
  adminAuth,
  fullAdminAuth,
  requirePermission("settings:manage"),
  fontController.remove,
);

module.exports = router;
