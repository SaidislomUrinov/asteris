const { Router } = require("express");
const coinController = require("../controllers/coin.controller");
const {
  tenantAuth,
  requireActiveSubscription,
  requireTenantPermission,
  requireTariffFeature,
  requireOwnCenterParam,
  requireStudentScope,
} = require("../middlewares/authenticator.middleware");

// WECOIN qoidalari va balanslar (API_CONTRACT_wecoin.md §3). Hodim faqat O'Z filiali.
const router = Router();

router.use(tenantAuth);
router.use(requireActiveSubscription);
router.use(requireTariffFeature("gamification.coins"));

// `/:centerId/...` dan OLDIN. active-centers — coin:view shart emas (individual switch).
router.get("/active-centers", coinController.activeCenters);
// O'quvchi detali — `/:centerId/...` dan OLDIN.
router.get("/student/:studentId", requireTenantPermission("coin:view"), requireStudentScope(), coinController.studentWallets);
router.get("/:centerId/settings", requireTenantPermission("coin:view"), requireOwnCenterParam(), coinController.getSettings);
router.put("/:centerId/settings", requireTenantPermission("coin:manage"), requireOwnCenterParam(), coinController.updateSettings);
router.get("/:centerId/students", requireTenantPermission("coin:view"), requireOwnCenterParam(), coinController.students);

module.exports = router;
