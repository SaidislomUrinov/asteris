const { Router } = require("express");

const router = Router();

// Ochiq health endpoint (auth yo'q) — uptime monitoringi uchun. `/admin/*`
// dan oldin turadi, chunki u yagona autentifikatsiyasiz yo'l.
router.use("/health", require("./routes/health.routes"));

// Platforma darajasidagi admin modullari — `/admin` dan OLDIN mount qilinadi,
// aks holda `admin.routes` prefiksni birinchi ushlab, 404 qaytarish xavfi bor.
router.use("/admin/monitoring", require("./routes/monitoring.routes"));
router.use("/admin/settings", require("./routes/systemSetting.routes"));

router.use("/admin", require("./routes/admin.routes"));
router.use("/leads", require("./routes/lead.routes"));
router.use("/tariffs", require("./routes/tariff.routes"));
router.use("/clients", require("./routes/client.routes"));
router.use("/client-auth", require("./routes/clientAuth.routes"));
router.use("/staff-auth", require("./routes/staffAuth.routes"));
router.use("/staffs", require("./routes/staff.routes"));
router.use("/centers", require("./routes/center.routes"));
router.use("/subjects", require("./routes/subject.routes"));
router.use("/rooms", require("./routes/room.routes"));
router.use("/groups", require("./routes/group.routes"));
router.use("/students", require("./routes/student.routes"));
router.use("/attendance", require("./routes/attendance.routes"));
router.use("/billing-settings", require("./routes/billingSetting.routes"));
router.use("/group-holidays", require("./routes/groupHoliday.routes"));
router.use("/salaries", require("./routes/salary.routes"));
router.use("/dashboard", require("./routes/dashboard.routes"));
router.use("/expenses", require("./routes/expense.routes"));
router.use("/grades", require("./routes/grade.routes"));
router.use("/syllabus", require("./routes/syllabus.routes"));
router.use("/notifications", require("./routes/notification.routes"));
router.use("/teacher", require("./routes/teacher.routes"));
router.use("/telegram", require("./routes/telegram.routes"));
router.use("/inpay", require("./routes/inpayWebhook.routes"));
module.exports = router;
