const { Router } = require("express");
const tariffController = require("../controllers/tariff.controller");
const {
  adminAuth,
  fullAdminAuth,
  requirePermission,
} = require("../middlewares/authenticator.middleware");

const router = Router();

// wenet.uz narx sahifasi uchun — autentifikatsiyasiz, `router.use(adminAuth)`
// dan OLDIN turishi shart. Faqat `isPublic` yoqilgan tariflarni qaytaradi.
router.get("/public", tariffController.publicList);
// Obuna muddati chegirmalari (docs/API_CONTRACT_tariff_discounts.md) — client
// obuna oynasi va sayt uchun ochiq o'qish.
router.get("/discounts", tariffController.getDiscounts);

router.use(adminAuth, fullAdminAuth);

router.post("/", requirePermission("tariff:create"), tariffController.create);
router.get("/", requirePermission("tariff:view"), tariffController.list);
router.put("/discounts", requirePermission("tariff:update"), tariffController.updateDiscounts);
router.get("/:id", requirePermission("tariff:view"), tariffController.getOne);
router.patch("/:id", requirePermission("tariff:update"), tariffController.update);
router.delete("/:id", requirePermission("tariff:delete"), tariffController.remove);

module.exports = router;
