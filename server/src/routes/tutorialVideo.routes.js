const { Router } = require("express");
const tutorialVideoController = require("../controllers/tutorialVideo.controller");
const {
  adminAuth,
  fullAdminAuth,
  requirePermission,
} = require("../middlewares/authenticator.middleware");

const router = Router();

// `GET /` ATAYLAB ochiq — Client ilovasi (Owner+Staff) ilova ochilishi
// bilan, auth/_id tayyor bo'lishini kutmasdan video havolalarini darhol
// yuklashi kerak (video maxfiy emas, `font.routes.js`dagi mantiq bilan bir xil).
// Faqat yuklash/o'chirish Platform Admin uchun cheklanadi.
router.get("/", tutorialVideoController.list);
router.put(
  "/:sectionKey",
  adminAuth,
  fullAdminAuth,
  requirePermission("settings:manage"),
  tutorialVideoController.upsert,
);
router.delete(
  "/:sectionKey",
  adminAuth,
  fullAdminAuth,
  requirePermission("settings:manage"),
  tutorialVideoController.remove,
);

module.exports = router;
