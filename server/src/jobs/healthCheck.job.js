const redis = require("../configs/redis.config");
const metrics = require("../middlewares/metrics.middleware");
const monitoringService = require("../services/monitoring.service");
const { sendAlert } = require("../bot/alert");
const { getNow } = require("../utils/date.util");

const TICK_SECONDS = 60;

// ioredis `keyPrefix: "asteris:"` ni o'zi qo'shadi — yakuniy kalitlar
// `asteris:scheduler:healthCheck:{tick}` va `asteris:health:lastStatus`.
const lockKey = (tick) => `scheduler:healthCheck:${tick}`;
const LAST_STATUS_KEY = "health:lastStatus";

// Bir tick faqat bitta worker'da bajariladi (cluster).
const acquireLock = async (tick) => {
  try {
    const res = await redis.set(lockKey(tick), "1", "EX", 120, "NX");
    return res === "OK";
  } catch {
    return false;
  }
};

const run = async () => {
  const tick = Math.floor(getNow() / TICK_SECONDS);
  if (!(await acquireLock(tick))) return;

  const health = await monitoringService.getHealth();

  // Tarix grafigi uchun infratuzilma kechikishi (mongo/redis) shu yerda yoziladi.
  const snapshotForLatency = await Promise.resolve()
    .then(() => monitoringService.getSnapshot())
    .catch(() => null);
  if (snapshotForLatency) {
    await metrics.recordHealthPing(
      snapshotForLatency.mongo.latencyMs,
      snapshotForLatency.redis.latencyMs,
    );
  }

  // Ogohlantirish FAQAT holat o'zgarganda yuboriladi — aks holda tushib
  // qolgan Mongo har daqiqada Telegram'ga xabar yog'dirardi.
  let previous = null;
  try {
    previous = await redis.get(LAST_STATUS_KEY);
  } catch {
    // Redis o'zi tushgan bo'lsa ogohlantirishni baribir yuboramiz
  }

  const current = health.status;
  if (previous === current) return;

  try {
    await redis.set(LAST_STATUS_KEY, current, "EX", 86400);
  } catch {
    // ...
  }

  // Server endigina ko'tarilgan bo'lsa (previous yo'q) va hammasi joyida —
  // sabab yo'q, xabar yuborilmaydi.
  if (!previous && current === "healthy") return;

  await sendAlert(
    "healthDegraded",
    {
      title: current === "healthy" ? "Tizim tiklandi" : "Tizim holati yomonlashdi",
      body:
        current === "healthy"
          ? "Mongo va Redis yana normal javob bermoqda."
          : "Infratuzilma komponentlaridan biri javob bermayapti.",
      meta: {
        Holat: current,
        Mongo: health.mongo,
        Redis: health.redis,
        PID: health.pid,
      },
    },
    { throttle: false },
  );
};

const start = () => {
  const timer = setInterval(() => {
    run().catch((error) => console.error("healthCheck:", error.message));
  }, TICK_SECONDS * 1000);
  timer.unref?.();
  console.log("Health check scheduler started (har 60s)");
};

module.exports = { start, run };
