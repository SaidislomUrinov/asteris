const { Router } = require("express");
const parentController = require("../controllers/parent.controller");
const { parentAuth } = require("../middlewares/authenticator.middleware");

const router = Router();

// Barcha `/parent/*` — parentAuth (API_CONTRACT_parent.md §4.1). Tenant
// tekshiruvi servis ichida, topilgan a'zolik bo'yicha (§4.10).
router.use(parentAuth);

router.get("/me", parentController.me);
router.get("/children", parentController.children);
router.get("/entries/:entryId/attendance", parentController.entryAttendance);
router.get("/entries/:entryId/grades", parentController.entryGrades);
router.get("/entries/:entryId/payments", parentController.entryPayments);
router.get("/entries/:entryId/rank", parentController.entryRank);
router.get("/entries/:entryId/homework", parentController.entryHomework);
router.get("/entries/:entryId/lesson-plan", parentController.entryLessonPlan);
router.get("/entries/:entryId/badges", parentController.entryBadges);
router.get("/entries/:entryId/qr-card", parentController.entryQrCard);
router.post("/entries/:entryId/qr-card/send", parentController.sendEntryQrCard);
router.get("/payments", parentController.payments);
// WECOIN va filial do'koni (API_CONTRACT_wecoin.md §4).
router.get("/coins", parentController.coins);
router.get("/coins/:studentId/:centerId/shop", parentController.coinShop);
router.post("/coins/:studentId/:centerId/shop/:productId/buy", parentController.coinBuy);
router.post("/coins/:studentId/:centerId/shop/:productId/like", parentController.coinLike);
router.get("/coins/:studentId/:centerId/history", parentController.coinHistory);
router.get("/notifications", parentController.notifications);
router.patch("/notifications/read-all", parentController.readAllNotifications);
router.patch("/settings", parentController.updateSettings);
router.patch("/role", parentController.updateRole);
router.post("/unlink", parentController.unlink);

module.exports = router;
