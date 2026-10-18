const { Router } = require("express");

const router = Router();

// Body'dagi Mongo operatorlari (`$ne`, `$gt`...) — har qanday route'dan OLDIN.
router.use(require("./middlewares/sanitize.middleware"));

// Ochiq health endpoint (auth yo'q) — uptime monitoringi uchun. `/admin/*`
// dan oldin turadi, chunki u yagona autentifikatsiyasiz yo'l.
router.use("/health", require("./routes/health.routes"));
// Sertifikat QR tekshiruvi — ham auth talab qilmaydi (kim ham tarasa
// tekshira olishi kerak), shuning uchun shu yerda health bilan bir qatorda.
router.use("/certificate-verify", require("./routes/certificateVerify.routes"));
// Chek (to'lov) QR tekshiruvi — xuddi shu naqsh, auth talab qilmaydi.
router.use("/payment-verify", require("./routes/paymentVerify.routes"));
// Shriftlar — `GET /` ochiq (sertifikat konstruktori/PDF uchun), yuklash
// esa faqat Platform Admin (`font.routes.js` ichida cheklangan).
router.use("/fonts", require("./routes/font.routes"));
// Video darslik havolalari — xuddi shu naqsh: `GET /` ochiq (Client
// ilovasi auth kutmasdan yuklaydi), yozish/o'chirish Platform Admin uchun.
router.use("/tutorial-videos", require("./routes/tutorialVideo.routes"));
// wenet.uz uchun ochiq statistika (mijozlar/o'quvchilar soni).
router.use("/stats", require("./routes/stats.routes"));

// Platforma darajasidagi admin modullari — `/admin` dan OLDIN mount qilinadi,
// aks holda `admin.routes` prefiksni birinchi ushlab, 404 qaytarish xavfi bor.
router.use("/admin/monitoring", require("./routes/monitoring.routes"));
// Server loglari (PM2 out/error fayllari) — faqat o'qish.
router.use("/admin/logs", require("./routes/serverLog.routes"));
router.use("/admin/settings", require("./routes/systemSetting.routes"));
// Qo'llab-quvvatlash chati (Platform Admin tomoni) — xuddi shu naqsh:
// `/admin` prefiksini `admin.routes` ushlab qolishidan oldin mount qilinadi.
router.use("/admin/chat", require("./routes/adminChat.routes"));
// Cross-tenant audit jurnali (Platform Admin) — xuddi shu naqsh: `/admin`
// prefiksini `admin.routes` ushlab qolishidan oldin mount qilinadi.
router.use("/admin/audit-logs", require("./routes/adminAudit.routes"));
// Yangiliklar (Platform Admin tomoni) — API_CONTRACT_news.md §2, xuddi shu naqsh.
router.use("/admin/news", require("./routes/adminNews.routes"));

router.use("/admin", require("./routes/admin.routes"));
router.use("/leads", require("./routes/lead.routes"));
router.use("/tariffs", require("./routes/tariff.routes"));
router.use("/clients", require("./routes/client.routes"));
// Yagona kirish (Owner yoki Hodim — raqam bo'yicha aniqlanadi), API_CONTRACT_staff_phone.md §2.
router.use("/auth", require("./routes/auth.routes"));
router.use("/client-auth", require("./routes/clientAuth.routes"));
router.use("/staff-auth", require("./routes/staffAuth.routes"));
router.use("/staffs", require("./routes/staff.routes"));
// Ota-ona Telegram WebApp (API_CONTRACT_parent.md §4) — alohida auth zanjiri.
router.use("/parent-auth", require("./routes/parentAuth.routes"));
router.use("/parent", require("./routes/parent.routes"));
router.use("/centers", require("./routes/center.routes"));
router.use("/subjects", require("./routes/subject.routes"));
router.use("/rooms", require("./routes/room.routes"));
router.use("/groups", require("./routes/group.routes"));
router.use("/students", require("./routes/student.routes"));
router.use("/student-leads", require("./routes/studentLead.routes"));
router.use("/attendance", require("./routes/attendance.routes"));
router.use("/billing-settings", require("./routes/billingSetting.routes"));
router.use("/group-holidays", require("./routes/groupHoliday.routes"));
router.use("/calendar", require("./routes/calendar.routes"));
router.use("/salaries", require("./routes/salary.routes"));
router.use("/dashboard", require("./routes/dashboard.routes"));
router.use("/expenses", require("./routes/expense.routes"));
router.use("/grades", require("./routes/grade.routes"));
router.use("/homework", require("./routes/homework.routes"));
// WECOIN va filial do'koni (API_CONTRACT_wecoin.md §3).
router.use("/coins", require("./routes/coin.routes"));
router.use("/shop", require("./routes/shop.routes"));
router.use("/reports", require("./routes/report.routes"));
// Audit jurnali — faqat Client Owner (`audit.routes.js` ichida `requireOwner`).
router.use("/audit-logs", require("./routes/audit.routes"));
router.use("/syllabus", require("./routes/syllabus.routes"));
// O'qituvchining shablon dars rejalari (API_CONTRACT_teaching_plans.md §4.1).
router.use("/teaching-plans", require("./routes/teachingPlan.routes"));
router.use("/notifications", require("./routes/notification.routes"));
// Yangiliklar (Client Owner + Staff) — API_CONTRACT_news.md §3.
router.use("/news", require("./routes/news.routes"));
router.use("/teacher", require("./routes/teacher.routes"));
// Ishchi Telegram WebApp paneli — faqat o'qish (API_CONTRACT_worker_webapp.md §3).
router.use("/worker", require("./routes/worker.routes"));
router.use("/telegram", require("./routes/telegram.routes"));
router.use("/inpay", require("./routes/inpayWebhook.routes"));
router.use("/certificate-templates", require("./routes/certificateTemplate.routes"));
router.use("/certificates", require("./routes/certificate.routes"));
router.use("/archive", require("./routes/archive.routes"));
// Yutuq nishonlari (API_CONTRACT_badges_monthly_rank.md §C).
router.use("/badges", require("./routes/badge.routes"));
router.use("/chat", require("./routes/chat.routes"));
// Mavjud bo'lmagan API yo'li — Express'ning HTML "Cannot GET" sahifasi
// o'rniga konvensiyadagi JSON.
router.use((req, res) => res.send({ ok: false, msg: "common.notFound" }));

module.exports = router;
