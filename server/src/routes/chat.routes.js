const { Router } = require("express");
const chatController = require("../controllers/chat.controller");
const { tenantAuth } = require("../middlewares/authenticator.middleware");

const router = Router();

// Client Owner YOKI Staff — ikkalasi ham kira oladi (tenantAuth mavjud
// dual-auth namunasi: x-client-auth-token yoki x-staff-auth-token).
router.use(tenantAuth);

router.get("/conversation", chatController.getConversation);
router.get("/messages", chatController.getMessages);
router.post("/messages", chatController.sendText);
router.post("/messages/image", chatController.sendImage);
router.post("/read", chatController.markRead);

module.exports = router;
