const { TEST_MONGO_URI, TEST_REDIS_DB, TEST_REDIS_PREFIX } = require("./env");
const mongoose = require("mongoose");

const TEST_DB_NAME = "wenet_test";

// Xavfsizlik to'ri: ulangan baza aynan `wenet_test` bo'lmasa hech narsa
// o'chirilmaydi (dev bazasini tasodifan tozalab yubormaslik uchun).
const assertTestDb = () => {
  const name = mongoose.connection?.db?.databaseName;
  if (name !== TEST_DB_NAME) throw new Error(`Refusing to touch non-test database: ${name}`);
};

const connect = async () => {
  // autoIndex/autoCreate o'chiq: aks holda ~40 kolleksiya indeksi fon rejimida
  // quriladi va `dropDatabase` ular tugashini kutib ~10 s osilib qoladi.
  // Testlar indekslarga (unikallik) tayanmaydi.
  await mongoose.connect(TEST_MONGO_URI, { autoIndex: false, autoCreate: false });
  assertTestDb();
  await mongoose.connection.db.dropDatabase();
};

// Faqat test prefiksidagi Redis kalitlarini o'chiradi (test DB ichida ham).
const clearRedis = async (redis) => {
  if (String(redis.options.db) !== TEST_REDIS_DB || redis.options.keyPrefix !== TEST_REDIS_PREFIX) {
    throw new Error("Refusing to touch non-test redis");
  }
  let cursor = "0";
  do {
    // SCAN MATCH'ga ioredis prefiks qo'shmaydi; DEL esa o'zi qo'shadi —
    // shuning uchun topilgan kalitdan prefiks olib tashlanadi.
    const [next, keys] = await redis.scan(cursor, "MATCH", `${TEST_REDIS_PREFIX}*`, "COUNT", 500);
    cursor = next;
    if (keys.length) await redis.del(...keys.map((k) => k.slice(TEST_REDIS_PREFIX.length)));
  } while (cursor !== "0");
};

const disconnect = async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      assertTestDb();
      await mongoose.connection.db.dropDatabase();
    }
  } finally {
    await mongoose.disconnect();
    // Redis ulanishi faqat kimdir uni require qilgan bo'lsa ochilgan.
    const redisPath = require.resolve("../../src/configs/redis.config");
    if (require.cache[redisPath]) {
      const redis = require.cache[redisPath].exports;
      try {
        await clearRedis(redis);
      } finally {
        await redis.quit().catch(() => redis.disconnect());
      }
    }
  }
};

module.exports = { connect, disconnect, assertTestDb, clearRedis };
