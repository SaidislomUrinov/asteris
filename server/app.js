const env = require("./src/configs/env.config");

const path = require("path");
const http = require("http");
const cluster = require("node:cluster");
const { availableParallelism } = require("node:os");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const fileUpload = require("express-fileupload");

const connectDB = require("./src/configs/db.config");
const { initIo } = require("./src/configs/socket.config");
const { ensureFolders } = require("./src/configs/folder.config");
const router = require("./src/router");
const errorHandler = require("./src/utils/error.util");

const app = express();

// Nginx ortida: rate-limit va req.ip haqiqiy mijoz IP'sini X-Forwarded-For'dan olsin.
app.set("trust proxy", 1);

app.use(helmet());
// exposedHeaders: Content-Disposition — Excel export fayl nomini frontend
// (cross-origin, 5173→5000) o'qiy olishi uchun (aks holda brauzer bu
// header'ni JS'dan yashiradi, fayl har doim "export.xlsx" bo'lib qoladi).
app.use(cors({ origin: env.ORIGINS, credentials: true, exposedHeaders: ["Content-Disposition"] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Global 10MB limit. Yangilik videosi (≤100MB) yuklanadigan yo'l bundan
// chetlab o'tadi — u `adminNews.routes.js` da o'zining 100MB limitli
// fileUpload'iga ega (API_CONTRACT_news.md §2). Aks holda global middleware
// 10MB'dan katta videoni route'ga yetmasdan 413 bilan kesib tashlardi.
const NEWS_MEDIA_PATH = "/api/admin/news/media";
const globalFileUpload = fileUpload({
  // `files`/`fields` — bitta so'rovda yuzlab fayl/maydon yuborib xotirani
  // to'ldirishdan himoya (fayllar xotirada saqlanadi).
  limits: { fileSize: 10 * 1024 * 1024, files: 10, fields: 200 },
  abortOnLimit: true,
  // 413 oddiy matn ("File size limit has been reached") o'rniga JSON.
  limitHandler: (req, res) => res.send({ ok: false, msg: "common.fileTooLarge" }),
});
app.use((req, res, next) =>
  req.path === NEWS_MEDIA_PATH || req.path === `${NEWS_MEDIA_PATH}/`
    ? next()
    : globalFileUpload(req, res, next),
);

// helmet() global CORP header (same-origin) static fayllarni boshqa origin'dan
// (masalan client:5174, admin:5173) <img> orqali yuklashni brauzerda bloklaydi —
// shu sabab bu bitta route uchun maqsadli yumshatiladi, qolgan API javoblari
// helmet default siyosati bilan himoyalangan holicha qoladi.
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    setHeaders: (res) => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  }),
);

// API metrikalari (docs/API_CONTRACT.md §4.2) — router'dan OLDIN, chunki har
// so'rovning davomiyligi va status kodi o'lchanadi. Redis'ga daqiqalik
// "rolling counter" yozadi; `/api/health` va `/uploads` o'lchanmaydi (shovqin).
app.use(require("./src/middlewares/metrics.middleware"));

// DDoS/suiiste'mol himoyasi (Redis'da, barcha worker'lar uchun umumiy) —
// bitta IP'dan daqiqasiga 1200 so'rov. Bir NAT ortida o'nlab hodim ishlaydigan
// markaz uchun ham yetarli zaxira; bundan oshishi — skript/hujum. Taqsimlangan
// (ko'p IP'li) hujumdan nginx/Cloudflare darajasida himoyalanadi.
const rateLimit = require("./src/utils/rateLimit.util");
app.use("/api", rateLimit({ name: "api", windowMs: 60 * 1000, limit: 1200 }));
// Excel eksport — og'ir (butun ro'yxat + exceljs, CPU). Daqiqasiga 20 ta.
const exportLimiter = rateLimit({ name: "export", windowMs: 60 * 1000, limit: 20 });
app.use("/api", (req, res, next) => (/\/export\/?$/.test(req.path) ? exportLimiter(req, res, next) : next()));

app.use("/api", router);

app.use(errorHandler);

const PORT = env.PORT;

// Kutilmagan, ushlanmagan promise xatosi (masalan Redis uzilganda
// `await`siz chaqirilgan buyruq) butun worker'ni yiqitmasin — logga yoziladi.
process.on("unhandledRejection", (reason) => {
  console.error("unhandledRejection:", reason?.stack || reason);
});

const start = async () => {
  const server = http.createServer(app);
  // Slowloris kabi sekin ulanishlardan himoya: sarlavhalar 20 s ichida kelishi
  // shart. `requestTimeout` 10 daqiqa — 100MB yangilik videosi sekin internetda
  // ham yuklanib ulgursin (qolgan so'rovlar bundan ancha tez tugaydi).
  server.headersTimeout = 20 * 1000;
  server.requestTimeout = 10 * 60 * 1000;
  server.keepAliveTimeout = 65 * 1000;

  ensureFolders();
  // sharp: keshsiz va cluster'da worker boshiga 1 oqim — aks holda har worker
  // CPU yadrolari sonicha libvips oqimi ochib, rasm yuklanganda RAM/CPU portlardi.
  const sharp = require("sharp");
  sharp.cache(false);
  if (env.NODE_ENV === "production") sharp.concurrency(1);
  await connectDB();
  await initIo(server);

  server.listen(PORT, () => {
    console.log(`Server ${process.pid} listening on port ${PORT}`);
  });

  // Rejalashtirilgan ishlar (darsga 1 soat qolgandagi eslatma). Cluster
  // rejimida har worker'da ishga tushadi, lekin Redis qulfi tufayli har
  // "tick" faqat bittasida bajariladi.
  require("./src/jobs/lessonReminder.job").start();
  require("./src/jobs/lessonFinished.job").start();
  require("./src/jobs/parentDebt.job").start();
  require("./src/jobs/morningReport.job").start();
  require("./src/jobs/eveningReport.job").start();
  require("./src/jobs/healthCheck.job").start();
  require("./src/jobs/subscriptionReminder.job").start();
  require("./src/jobs/subscriptionPaymentExpire.job").start();
  require("./src/jobs/backup.job").start();
  require("./src/jobs/badges.job").start();

  // Telegram bot — faqat platforma sozlamalarida yoqilgan va token mavjud
  // bo'lsa ko'tariladi. Cluster'da Redis qulfi orqali faqat BITTA worker
  // polling qiladi (aks holda Telegram 409 Conflict qaytaradi).
  require("./src/bot").start();
};

// Cluster — API_CONTRACT_performance.md §5. Node bitta protsessda bitta CPU
// yadrosidan foydalanadi; 20+ markaz bir vaqtda ishlaganda bu shishaning
// bo'yni bo'ladi. Socket.IO xonalari workerlar orasida ishlashi uchun
// `@socket.io/redis-adapter` allaqachon socket.config.js da ulangan —
// shusiz bir worker'dagi `emit` boshqa worker'ga ulangan mijozga bormasdi.
//
// Faqat productionda: dev'da bitta protsess qulayroq (nodemon qayta ishga
// tushirishi, log'lar aralashmasligi, debugger ulanishi).
if (env.NODE_ENV === "production" && cluster.isPrimary) {
  // Har worker ~190MB RAM: default 4 tadan oshmaydi (8 yadroli serverda
  // 8 worker ~1.5GB edi). Ko'proq kerak bo'lsa CLUSTER_WORKERS bilan.
  const count = env.CLUSTER_WORKERS || Math.min(availableParallelism(), 4);
  console.log(`Primary ${process.pid} starting ${count} workers`);

  for (let i = 0; i < count; i++) cluster.fork();

  // Worker qulab tushsa o'rniga yangisi ko'tariladi — aks holda har xatolik
  // serverning imkoniyatini doimiy kamaytirib borardi.
  cluster.on("exit", (worker, code, signal) => {
    console.error(`Worker ${worker.process.pid} exited (${signal || code}) — restarting`);
    cluster.fork();
  });
} else {
  start();
}
