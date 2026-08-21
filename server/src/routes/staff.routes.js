const { Router } = require("express");
const staffController = require("../controllers/staff.controller");
const {
  clientAuth,
  fullClientAuth,
  tenantAuth,
  requireTariffFeature,
  requireActiveSubscription,
} = require("../middlewares/authenticator.middleware");

const router = Router();

// Yengil o'qituvchi/hodim nomlari ro'yxati — Owner HAM, Staff HAM (Guruh/Xona
// sahifalaridagi "O'qituvchi" filtri uchun) chaqira oladi. MUHIM: bu route
// pastdagi `clientAuth`dan OLDIN, alohida `tenantAuth` bilan ro'yxatdan
// o'tkaziladi — aks holda Staff sessiyasi bilan chaqirilganda `clientAuth`
// (faqat Owner header'ini qabul qiladigan) "auth.failed" bilan qaytaradi, bu
// esa frontend interceptor'ida ikkinchi marta ham muvaffaqiyatsiz bo'lib,
// BUTUN sessiyani (localStorage/redux) o'chirib yuborardi — Groups/Room
// detail sahifalari xuddi shu endpointni chaqirgani uchun "bo'limga o'tganda
// Auth'dan chiqib ketish" bagi shu yerdan kelib chiqqan edi.
router.get("/lookup", tenantAuth, staffController.lookup);

// Qolgan hammasi — faqat Client Owner (yaratish/tahrirlash/o'chirish/bloklash,
// TO'LIQ ro'yxat/detail — maosh va permissionlar bilan)
router.use(clientAuth, fullClientAuth);
router.use(requireActiveSubscription);

router.post("/", staffController.create);
router.get("/", staffController.list);
router.get("/export", requireTariffFeature("excel.export"), staffController.exportList);
router.get("/:id", staffController.getOne);
router.patch("/:id", staffController.update);
router.delete("/:id", staffController.remove);
router.patch("/:id/block", staffController.block);
router.patch("/:id/unblock", staffController.unblock);

module.exports = router;
