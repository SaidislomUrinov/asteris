const { Router } = require("express");
const newsController = require("../controllers/news.controller");
const { tenantAuth } = require("../middlewares/authenticator.middleware");

const router = Router();

// Yangiliklar (API_CONTRACT_news.md §3) — bildirishnoma kabi SHAXSIY,
// permission talab qilmaydi. `requireActiveSubscription` ATAYLAB ulanmagan:
// obuna read-only bo'lsa ham o'qish va "o'qildi" (POST) ishlashi kerak.
router.use(tenantAuth);

router.get("/", newsController.list);
router.get("/unread", newsController.unread);
router.get("/unread-count", newsController.unreadCount);
router.post("/read-all", newsController.markAllRead);
router.post("/:id/read", newsController.markRead);

module.exports = router;
