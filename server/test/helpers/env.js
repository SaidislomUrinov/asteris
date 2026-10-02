// Test muhiti — HAR test fayli birinchi qatorda shu modulni require qiladi,
// `src/` dagi har qanday moduldan OLDIN. dotenv mavjud kalitlarni qayta
// yozmaydi, shuning uchun bu yerda qo'yilgan qiymatlar `.env` dan ustun turadi.
//
// - MongoDB: faqat `wenet_test` (dev bazasi `wenet` ga hech qachon yozilmaydi).
// - Redis: alohida DB (14) + alohida prefiks — dev/prod sessiyalariga tegmaydi.
// - Telegram: token bo'sh — 5xx ogohlantirishlari hech qayerga ketmaydi.
const TEST_MONGO_URI = "mongodb://127.0.0.1:27017/wenet_test";
const TEST_REDIS_DB = "14";
const TEST_REDIS_PREFIX = "wenet_test:";

Object.assign(process.env, {
  NODE_ENV: "test",
  MONGO_URI: TEST_MONGO_URI,
  REDIS_DB: TEST_REDIS_DB,
  REDIS_KEY_PREFIX: TEST_REDIS_PREFIX,
  TELEGRAM_BOT_TOKEN: "",
  TELEGRAM_ALERT_CHAT_IDS: "",
  CLIENT_JWT_SECRET: "test-client-secret",
  STAFF_JWT_SECRET: "test-staff-secret",
  ADMIN_JWT_SECRET: "test-admin-secret",
  ADMIN_REFRESH_JWT_SECRET: "test-admin-refresh-secret",
  PARENT_JWT_SECRET: "test-parent-secret",
});

module.exports = { TEST_MONGO_URI, TEST_REDIS_DB, TEST_REDIS_PREFIX };
