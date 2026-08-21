const { Router } = require("express");
const auditController = require("../controllers/audit.controller");
const {
  tenantAuth,
  requireOwner,
  requireTariffFeature,
} = require("../middlewares/authenticator.middleware");

const router = Router();

// Audit jurnali — FAQAT Client Owner. Hodim o'z ustidan yuritilgan
// jurnalni ko'ra olmaydi (aks holda nazorat ma'nosini yo'qotadi).
// `requireActiveSubscription` shart emas: bu yerda faqat GET bor va
// obuna tugaganda ham ko'rish ochiq qoladi (Read-Only rejimi).
router.use(tenantAuth);
router.use(requireOwner);

router.get("/", auditController.list);
router.get("/filters", auditController.filters);
router.get("/export", requireTariffFeature("excel.export"), auditController.exportList);

module.exports = router;
