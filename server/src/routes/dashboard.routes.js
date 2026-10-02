const { Router } = require("express");
const dashboardController = require("../controllers/dashboard.controller");
const { tenantAuth, requireTenantPermission } = require("../middlewares/authenticator.middleware");

const router = Router();

router.use(tenantAuth);

// Moliyaviy ko'rsatkichlar (oylik tushum, qarzdorlik) — hodim uchun
// `dashboard:view` shart. Avval cheklovsiz edi va o'qituvchi/yordamchi ham
// filial daromadini ko'ra olardi (QA 2026-10-02). O'qituvchi bosh sahifasi
// o'zining `/teacher/dashboard` endpointidan foydalanadi.
router.get("/", requireTenantPermission("dashboard:view"), dashboardController.stats);
// Bugungi darslar — moliya emas, guruh ro'yxati (`group:view`).
router.get("/today-lessons", requireTenantPermission("group:view"), dashboardController.todayLessons);

module.exports = router;
