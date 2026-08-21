const { Router } = require("express");
const centerController = require("../controllers/center.controller");
const {
  tenantAuth,
  requireOwner,
  requireActiveSubscription,
} = require("../middlewares/authenticator.middleware");

const router = Router();

router.use(tenantAuth);

// DIQQAT: bu ikki endpoint `requireActiveSubscription` DAN OLDIN turadi
// (API_CONTRACT.md §7.1.2). Tarif pasayganda majburiy modal aynan shu
// so'rovlarga tayanadi — obuna muammoli holatda ham ishlashi shart, aks
// holda foydalanuvchi modaldan chiqa olmay qulflanib qolardi.
// Faqat Client Owner: hodim tarif qaroriga aralashmaydi.
router.get("/overflow", requireOwner, centerController.overflow);
router.post("/resolve-overflow", requireOwner, centerController.resolveOverflow);

router.use(requireActiveSubscription);

// Ko'rish — Owner hammasini, Staff faqat o'z markazini ko'radi (controller cheklaydi).
// Yaratish/tahrirlash/o'chirish — faqat Client Owner (Center CRUD staff permission emas).
router.post("/", requireOwner, centerController.create);
router.get("/", centerController.list);
router.get("/:id", centerController.getOne);
router.patch("/:id", requireOwner, centerController.update);
router.post("/:id/unblock", requireOwner, centerController.unblock);
router.delete("/:id", requireOwner, centerController.remove);

module.exports = router;
