const { Router } = require("express");
const workerController = require("../controllers/worker.controller");
const { tenantAuth } = require("../middlewares/authenticator.middleware");

const router = Router();

// Owner YOKI Staff (brauzer yoki Telegram "tg" tokeni — §1.1). Ruxsat/tarif
// bo'yicha filtrlash servis ichida: ruxsatsiz KPI/voqea shunchaki qo'shilmaydi.
router.use(tenantAuth);

router.get("/me", workerController.me);
router.get("/today", workerController.today);

module.exports = router;
