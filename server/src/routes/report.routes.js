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

// Davomat hisoboti — moliyaviy hisobotdan MUSTAQIL tarif flag'i
// (`attendance.report`), shuning uchun `finance.report` gate'idan OLDIN
// e'lon qilinadi: moliyaviy hisobotsiz tarifda ham ishlayveradi.
router.get(
  "/attendance/export",
  requireTariffFeature("attendance.report"),
  requireTenantPermission("report:export"),
  requireTariffFeature("excel.export"),
  reportController.exportAttendance,
);
router.get("/attendance", requireTariffFeature("attendance.report"), reportController.attendance);

router.use(requireTariffFeature("finance.report"));

router.get("/summary", reportController.summary);
router.get("/timeline", reportController.timeline);
router.get("/by-center", reportController.byCenter);
router.get(
  "/by-teacher",
  requireTariffFeature("teacher.performance"),
  reportController.byTeacher
);
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
