const { Router } = require("express");
const adminChatController = require("../controllers/adminChat.controller");
const {
  adminAuth,
  fullAdminAuth,
  requirePermission,
} = require("../middlewares/authenticator.middleware");

const router = Router();

router.use(adminAuth, fullAdminAuth);

router.get(
  "/conversations",
  requirePermission("chat:view"),
  adminChatController.listConversations,
);
router.get(
  "/conversations/:id/messages",
  requirePermission("chat:view"),
  adminChatController.getMessages,
);
router.post(
  "/conversations/:id/messages",
  requirePermission("chat:reply"),
  adminChatController.sendText,
);
router.post(
  "/conversations/:id/messages/image",
  requirePermission("chat:reply"),
  adminChatController.sendImage,
);
router.post(
  "/conversations/:id/greeting",
  requirePermission("chat:reply"),
  adminChatController.sendGreeting,
);
router.post(
  "/conversations/:id/read",
  requirePermission("chat:view"),
  adminChatController.markRead,
);

module.exports = router;
