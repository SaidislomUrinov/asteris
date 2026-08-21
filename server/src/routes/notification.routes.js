const { Router } = require("express");
const notificationController = require("../controllers/notification.controller");
const { tenantAuth } = require("../middlewares/authenticator.middleware");

const router = Router();

// Bildirishnoma — shaxsiy, permission talab qilmaydi (har kim o'zinikini
// ko'radi). Obuna tugagan bo'lsa ham o'qish mumkin (faqat GET/PATCH read).
router.use(tenantAuth);

router.get("/", notificationController.list);
router.get("/unread-count", notificationController.unreadCount);
router.patch("/read-all", notificationController.markAllRead);
router.patch("/:id/read", notificationController.markRead);

module.exports = router;
