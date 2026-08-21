const { REDIS_KEY_PREFIX } = require("./env.config");

module.exports = {
  admin: (objectId) => `${REDIS_KEY_PREFIX}admin:${objectId}`,
  adminAccess: (objectId) => `${REDIS_KEY_PREFIX}admin_access:${objectId}`,
  adminRefresh: (objectId) => `${REDIS_KEY_PREFIX}admin_refresh:${objectId}`,

  client: (objectId) => `${REDIS_KEY_PREFIX}client:${objectId}`,
  clientAccess: (objectId) => `${REDIS_KEY_PREFIX}client_access:${objectId}`,
  clientRefresh: (objectId) => `${REDIS_KEY_PREFIX}client_refresh:${objectId}`,

  staff: (objectId) => `${REDIS_KEY_PREFIX}staff:${objectId}`,
  staffAccess: (objectId) => `${REDIS_KEY_PREFIX}staff_access:${objectId}`,
  staffRefresh: (objectId) => `${REDIS_KEY_PREFIX}staff_refresh:${objectId}`,

  inpayToken: () => `${REDIS_KEY_PREFIX}inpay_token`,

  billingSetting: (centerId) => `${REDIS_KEY_PREFIX}billing_setting:${centerId}`,
  attendanceSetting: (centerId) => `${REDIS_KEY_PREFIX}attendance_setting:${centerId}`,

  // Rejalashtiruvchi qulfi — cluster rejimida bir necha worker bir vaqtda
  // ishga tushmasligi uchun (SET NX EX).
  schedulerLock: (name, tick) => `${REDIS_KEY_PREFIX}scheduler:${name}:${tick}`,

  // ---------------------------------------------------------------------
  // DIQQAT — prefiks haqida.
  // ioredis `keyPrefix: "asteris:"` bilan sozlangan (configs/redis.config.js)
  // va uni get/set/del'ga AVTOMATIK qo'shadi. Yuqoridagi ESKI kalitlar bunga
  // qo'shimcha `REDIS_KEY_PREFIX` ni ham qo'lda yozadi, ya'ni Redis'da ular
  // aslida `asteris:asteris:admin:{id}` ko'rinishida yotibdi. Bu ishlaydi
  // (yozish ham, o'qish ham bir xil funksiyadan o'tadi), lekin CLAUDE.md dagi
  // `asteris:{entity}:{id}` naqshiga mos emas.
  //
  // QUYIDAGI YANGI kalitlar `dashboardCache.util.js` bilan bir xil, TO'G'RI
  // yo'ldan boradi: prefiks qo'lda yozilmaydi, faqat ioredis qo'shadi.
  // Eski kalitlarni ko'chirish alohida migratsiya ishi (barcha sessiyalar
  // uzilib ketmasligi uchun bu yerda qilinmadi).
  // ---------------------------------------------------------------------

  // Hisobot keshi — parametrlar hash'i bo'yicha (docs/API_CONTRACT.md §2.1).
  // Hisobot parametrlari (period/from/to/center) kombinatsiyasi ko'p, shuning
  // uchun invalidatsiya SCAN bilan prefiks bo'yicha guruh sifatida o'chiriladi.
  reportCache: (clientId, hash) => `cache:report:${clientId}:${hash}`,
  // SCAN naqshi — MATCH'ga ioredis prefiksni QO'SHMAYDI, chaqiruvchi uni
  // qo'lda qo'shadi (dashboardCache.util.js `invalidate` izohiga qara).
  reportCachePattern: (clientId) => `cache:report:${clientId}:*`,

  // API metrikalari — daqiqalik "rolling counter" hash'i (§4.2).
  // Cluster'da har worker AYNAN shu kalitga HINCRBY qiladi, shuning uchun
  // yig'indi to'g'ri chiqadi (protsess ichidagi hisoblagich bo'lsa har worker
  // o'zinikini ko'rsatib, umumiy rasm buzilardi).
  metricsBucket: (minuteKey) => `metrics:${minuteKey}`,
  metricsPattern: () => `metrics:*`,

  // Platforma sozlamalari (SMTP/Telegram/Storage/Backup) — singleton hujjat keshi.
  systemSetting: () => `system_setting`,

  // Telegram ogohlantirishlari uchun throttle — bir xil turdagi xabar
  // daqiqasiga bir martadan ko'p yuborilmasin (5xx portlaganda bot spamlamasin).
  alertThrottle: (type) => `alert_throttle:${type}`,
  // Health holati o'zgarganda YAGONA marta xabar yuborish uchun oxirgi holat.
  alertState: (type) => `alert_state:${type}`,
  // Telegram botni cluster'da faqat BITTA worker polling qilishi uchun qulf
  // (aks holda Telegram 409 Conflict qaytaradi).
  botOwnerLock: () => `bot_owner_lock`,

  // Shaxsiy Telegram bog'lash tokeni — "Telegramni ulash" bosilganda
  // generatsiya qilinadi, `/start {token}` orqali botda ishlatiladi (bir
  // martalik, TTL bilan). Qiymati JSON: {kind:"client"|"staff", id}.
  telegramLinkToken: (token) => `telegram_link:${token}`,
};
