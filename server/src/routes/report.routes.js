const { Router } = require("express");
const reportController = require("../controllers/report.controller");
const {
  tenantAuth,
  requireActiveSubscription,
  requireTenantPermission,
  requireTariffFeature,
} = require("../middlewares/authenticator.middleware");

const router = Router();

// Barcha hisobotlar `report:view` ostida. O'qituvchi/yordamchi o'qituvchi
// bu ruxsatni UMUMAN ola olmaydi (staffPermission.util.js), Resepshin esa
// olsa ham faqat o'z filialini ko'radi — `tenantAuth` `center` filtrini
// majburan o'ziga almashtiradi.
router.use(tenantAuth);
router.use(requireActiveSubscription);
router.use(requireTenantPermission("report:view"));

router.get("/summary", reportController.summary);
router.get("/timeline", reportController.timeline);
router.get("/by-center", reportController.byCenter);
router.get("/by-teacher", reportController.byTeacher);
router.get("/by-collector", reportController.byCollector);
router.get("/by-group", reportController.byGroup);
router.get("/debtors", reportController.debtors);
router.get(
  "/export",
  requireTenantPermission("report:export"),
  requireTariffFeature("excel.export"),
  reportController.exportAll,
);

module.exports = router;
