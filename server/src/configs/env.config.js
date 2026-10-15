if (process.env.NODE_ENV !== "production") require("dotenv").config();

const env = process.env;

module.exports = {
  NODE_ENV: env.NODE_ENV || "development",
  PORT: env.PORT || 5000,
  MONGO_URI: env.MONGO_URI,
  JWT_SECRET: env.JWT_SECRET,

  // "Bitta qurilmadan sessiya" tekshiruvi — token so'nggi login bilan
  // Redis'dagi bilan aynan mos kelishi shart (authenticator.middleware.js
  // "adminAuth"/"clientAuth"/"staffAuth"). Dasturchi/test paytida bir nechta
  // tab/curl bilan bir vaqtda ishlash uchun development'da o'chirilgan,
  // productionda (NODE_ENV=production) doim yoqiladi — qo'lda hech narsa
  // "qaytarib qo'yish" shart emas, avtomatik ishlaydi.
  ENFORCE_SINGLE_DEVICE_SESSION: (env.NODE_ENV || "development") === "production",

  ADMIN_NAME: env.ADMIN_NAME,
  ADMIN_PASS: env.ADMIN_PASS,
  ADMIN_USERNAME: env.ADMIN_USERNAME,
  ADMIN_JWT_SECRET: env.ADMIN_JWT_SECRET,
  ADMIN_REFRESH_JWT_SECRET: env.ADMIN_REFRESH_JWT_SECRET,
  ADMIN_ACCESS_EXPIRES_IN: "15m",
  ADMIN_SESSION_TTL: 86400, // so'nggi faollikdan 24 soat harakatsizlikdan keyin sessiya tugaydi

  // Client Owner login (client panel) — refresh token yo'q, access token
  // muddatsiz (jwtUtil.sign expiresIn'siz). Sessiya faqat signOut yoki
  // Redis'dagi `client_access` kaliti boshqa qurilma login qilganda
  // almashtirilganda tugaydi (shu TTL bilan sliding-touch qilinadi).
  CLIENT_JWT_SECRET: env.CLIENT_JWT_SECRET,
  CLIENT_SESSION_TTL: 31536000, // 365 kun

  // Staff (Center Manager / Reception / Teacher) login — client panel bilan bir xil frontend, alohida auth zanjiri.
  // Refresh token yo'q, access token muddatsiz — CLIENT bilan bir xil naqsh.
  STAFF_JWT_SECRET: env.STAFF_JWT_SECRET,
  STAFF_SESSION_TTL: 31536000, // 365 kun

  // Ota-ona Telegram WebApp (API_CONTRACT_parent.md §4.1) — JWT 30 kun,
  // refresh YO'Q, Redis sessiya YO'Q: WebApp har ochilganda initData bilan
  // qayta token oladi. Fallback yo'q — `.env`da bo'lishi SHART.
  PARENT_JWT_SECRET: env.PARENT_JWT_SECRET,
  PARENT_ACCESS_EXPIRES_IN: "30d",
  // WebApp manzili — admin sozlamasi (`SystemSetting.telegram.parentWebAppUrl`)
  // bo'sh/https emas bo'lsa shu ishlatiladi. Aks holda bot "Dasturga" va menyu
  // "Dastur" tugmalari jimgina yo'qolardi (prod'da sozlama kiritilmagan edi).
  PARENT_WEBAPP_URL: env.PARENT_WEBAPP_URL || "https://parent.wenet.uz",

  // Obuna to'lovlari uchun (Client Owner -> platforma), inPAY orqali
  SERVER_URL: env.SERVER_URL || "http://localhost:5000",
  CLIENT_APP_URL: env.CLIENT_APP_URL || "http://localhost:5174",
  // Brend subdomenlari: `{slug}.{ROOT_DOMAIN}` (API_CONTRACT_multi_center.md §8).
  // Dev'da `{slug}.localhost:{port}` — CLIENT_APP_URL localhost bo'lsa avtomatik.
  ROOT_DOMAIN: env.ROOT_DOMAIN || "wenet.uz",
  INPAY_BASE_URL: env.INPAY_BASE_URL || "https://inpay.uz/api/v1",
  INPAY_MERCHANT_ID: env.INPAY_MERCHANT_ID,
  INPAY_MERCHANT_TOKEN: env.INPAY_MERCHANT_TOKEN,

  // 0 yoki bo'sh = CPU yadrolari soni bo'yicha (API_CONTRACT_performance.md §5)
  CLUSTER_WORKERS: Number(env.CLUSTER_WORKERS) || 0,

  REDIS_HOST: env.REDIS_HOST || "127.0.0.1",
  REDIS_PORT: Number(env.REDIS_PORT) || 6379,
  REDIS_PASS: env.REDIS_PASS || undefined,
  REDIS_DB: Number(env.REDIS_DB) || 0,
  REDIS_KEY_PREFIX: env.REDIS_KEY_PREFIX || "asteris:",

  // Zaxira nusxa (backup) fayllari saqlanadigan papka — `jobs/backup.job.js`
  // shu yerga `mongodump` chiqishini yozadi va `keepDays` dan eskilarini
  // tozalaydi. Server ildizidan tashqarida bo'lgani ma'qul (deploy paytida
  // qayta yozilib ketmasligi uchun), shuning uchun env orqali beriladi.
  BACKUP_DIR: env.BACKUP_DIR || "./backups",
  // `mongodump` binariga yo'l — PATH'da bo'lsa shunchaki nomi yetarli.
  MONGODUMP_BIN: env.MONGODUMP_BIN || "mongodump",

  // Sozlamalar bazada (SystemSetting) saqlanadi, lekin BAZA hali bo'sh
  // bo'lganda yoki Mongo tushganda ham bot ishlashi uchun zaxira qiymat.
  // Baza qiymati har doim ustun turadi.
  TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN || "",
  TELEGRAM_ALERT_CHAT_IDS: (env.TELEGRAM_ALERT_CHAT_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  // package.json'dan versiya — /api/health va monitoring javobida ko'rsatiladi
  APP_VERSION: require("../../package.json").version,

  ORIGINS: env.ORIGINS
    ? env.ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
    : [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "https://wenet.uz",
        "https://www.wenet.uz",
        "https://app.wenet.uz",
        "https://www.app.wenet.uz",
        "https://console.wenet.uz",
        "https://www.console.wenet.uz",
        "https://parent.wenet.uz",
        "https://www.parent.wenet.uz",
        "https://asteris.uz",
        "https://www.asteris.uz",
      ],
};
