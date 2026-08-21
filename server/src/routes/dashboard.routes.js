const { Router } = require("express");
const dashboardController = require("../controllers/dashboard.controller");
const { tenantAuth } = require("../middlewares/authenticator.middleware");

const router = Router();

router.use(tenantAuth);

// Dashboard barcha tenant foydalanuvchilar (Owner + har qanday Staff) uchun
// ochiq — bosh sahifa sifatida cheklovsiz ko'rinadi (CLAUDE.md permission
// jadvalidagi "dashboard:view" granular ruxsat sifatida emas, umumiy kirish
// nuqtasi sifatida talqin qilinadi).
router.get("/", dashboardController.stats);
router.get("/today-lessons", dashboardController.todayLessons);

module.exports = router;
