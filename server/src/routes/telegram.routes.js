const { Router } = require("express");
const telegramController = require("../controllers/telegram.controller");
const { tenantAuth, requireActiveSubscription } = require("../middlewares/authenticator.middleware");

const router = Router();

// Client Owner yoki Staff — har kim FAQAT o'zining bog'lanishini boshqaradi
// (permission emas, "self" doirasi — controller `req.client`/`req.staff`dan
// aniqlaydi, ID hech qachon body/paramdan olinmaydi).
router.use(tenantAuth);
router.use(requireActiveSubscription);

router.post("/link", telegramController.link);
router.get("/status", telegramController.status);
router.post("/unlink", telegramController.unlink);
router.patch("/lang", telegramController.setLang);

module.exports = router;
