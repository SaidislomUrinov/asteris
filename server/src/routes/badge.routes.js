const { Router } = require("express");
const badgeController = require("../controllers/badge.controller");
const {
  tenantAuth,
  requireTenantPermission,
  requireTariffFeature,
  requireTeacherGroup,
  teachingScopeField,
} = require("../middlewares/authenticator.middleware");
const { BADGE_FEATURE } = require("../utils/badge.util");

const router = Router();

// Yutuq nishonlari — premium, tarif flagi `gamification.badges`
// (API_CONTRACT_badges_monthly_rank.md §C). Faqat o'qish (GET) — berish
// oy yakunida jobs/badges.job.js orqali.
router.use(tenantAuth);
router.use(requireTariffFeature(BADGE_FEATURE));

// Guruh ro'yxatidagi ikonkalar — GroupDetail (`group:view`) VA o'qituvchining
// /lesson sahifasi (`attendance:view`, `/attendance/:groupId/summary` bilan
// bir xil). Ikkisidan biri yetarli; o'qituvchi/yordamchi faqat O'Z guruhi.
const groupOrAttendanceView = (req, res, next) =>
  requireTenantPermission("group:view")(req, res, (err) =>
    err ? requireTenantPermission("attendance:view")(req, res, next) : next(),
  );
router.get("/group/:groupId", groupOrAttendanceView, requireTeacherGroup(), badgeController.getGroup);

// O'quvchi sahifasi. Owner/hodim — `/students/:id` bilan bir xil (`student:view`).
// O'qituvchi/yordamchi — `student:view` siz, lekin servis faqat O'ZI dars
// beradigan guruhlardagi yutuqlarni qaytaradi (pul/kontakt yo'q —
// API_CONTRACT_student_achievements.md).
const studentViewOrTeaching = (req, res, next) =>
  teachingScopeField(req) ? next() : requireTenantPermission("student:view")(req, res, next);
router.get("/student/:studentId", studentViewOrTeaching, badgeController.getStudent);

module.exports = router;
