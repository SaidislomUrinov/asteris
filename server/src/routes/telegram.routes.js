const { Router } = require("express");
const telegramController = require("../controllers/telegram.controller");
const {
  tenantAuth,
  requireActiveSubscription,
  requireTariffFeature,
} = require("../middlewares/authenticator.middleware");

const router = Router();

// Client Owner yoki Staff — har kim FAQAT o'zining bog'lanishini boshqaradi
// (permission emas, "self" doirasi — controller `req.client`/`req.staff`dan
// aniqlaydi, ID hech qachon body/paramdan olinmaydi).
router.use(tenantAuth);

// O'quvchi/ota-ona botining ochiq havolasi — o'qituvchi o'quvchilariga
// yuborishi uchun (API_CONTRACT_student_telegram_pair.md §5). Obuna/tarifdan
// oldin: ota-ona boti tarif bilan cheklanmagan, havola esa sir emas.
router.get("/bot", telegramController.botInfo);

router.use(requireActiveSubscription);
router.use(requireTariffFeature("telegram.notifications"));

router.post("/link", telegramController.link);
router.get("/status", telegramController.status);
router.post("/unlink", telegramController.unlink);
router.patch("/lang", telegramController.setLang);

module.exports = router;
