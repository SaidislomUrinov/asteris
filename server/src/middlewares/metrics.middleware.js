const moment = require("moment-timezone");
const redis = require("../configs/redis.config");

const TZ = "Asia/Tashkent";

// ioredis `keyPrefix: "asteris:"` ni AVTOMATIK qo'shadi (configs/redis.config.js),
// shuning uchun bu yerda prefiks yozilmaydi — Redis'dagi yakuniy kalit
// `asteris:metrics:{YYYYMMDDHHmm}`.
const PREFIX = "metrics";

// 25 soat — tarix 24 soatga so'ralganda chekkadagi bucket ham tirik qoladi.
const TTL_SECONDS = 90_000;

// O'lchanmaydigan yo'llar: health monitoring xizmati tomonidan har daqiqada
// so'raladi va statik fayllar — ikkalasi ham haqiqiy API yukini buzadi.
const IGNORED = [/^\/api\/health/, /^\/uploads/];

const minuteKeyOf = (date) => moment(date).tz(TZ).format("YYYYMMDDHHmm");
const bucketKeyOf = (minuteKey) => `${PREFIX}:${minuteKey}`;

// Oxirgi `minutes` daqiqaning kalitlari — eng yangisidan eskisiga.
const recentMinuteKeys = (minutes) => {
  const base = moment().tz(TZ).startOf("minute");
  const keys = [];
  for (let i = 0; i < minutes; i++) keys.push(base.clone().subtract(i, "minutes").format("YYYYMMDDHHmm"));
  return keys;
};

// `mongoMs`/`redisMs`/`pings` ni middleware emas, `healthCheck.job.js` yozadi
// (har 60s bir marta) — shu sabab tarixda infratuzilma kechikishi ham bo'ladi.
const EMPTY = {
  count: 0,
  duration: 0,
  "2xx": 0,
  "3xx": 0,
  "4xx": 0,
  "5xx": 0,
  mongoMs: 0,
  redisMs: 0,
  pings: 0,
};

// Bir nechta bucketni bitta pipeline bilan o'qiydi (N ta round-trip emas).
const readBuckets = async (minuteKeys) => {
  try {
    const pipeline = redis.pipeline();
    minuteKeys.forEach((k) => pipeline.hgetall(bucketKeyOf(k)));
    const res = await pipeline.exec();

    return minuteKeys.map((k, i) => {
      const raw = res?.[i]?.[1] || {};
      const parsed = { ...EMPTY };
      for (const field of Object.keys(EMPTY)) parsed[field] = Number(raw[field] || 0);
      return { minuteKey: k, ...parsed };
    });
  } catch {
    // Redis tushsa metrika yo'q — bu monitoringni to'xtatmaydi, nol qaytadi.
    return minuteKeys.map((k) => ({ minuteKey: k, ...EMPTY }));
  }
};

// Bucketlar yig'indisidan ko'rsatkichlar.
const aggregate = (buckets, minutes) => {
  const total = buckets.reduce(
    (acc, b) => {
      acc.count += b.count;
      acc.duration += b.duration;
      acc["2xx"] += b["2xx"];
      acc["3xx"] += b["3xx"];
      acc["4xx"] += b["4xx"];
      acc["5xx"] += b["5xx"];
      return acc;
    },
    { ...EMPTY },
  );

  const errors = total["4xx"] + total["5xx"];

  return {
    rpm: Math.round(total.count / Math.max(1, minutes)),
    avgLatencyMs: total.count ? Math.round(total.duration / total.count) : 0,
    errorRate: total.count ? Number(((errors / total.count) * 100).toFixed(2)) : 0,
    statusCounts: {
      "2xx": total["2xx"],
      "3xx": total["3xx"],
      "4xx": total["4xx"],
      "5xx": total["5xx"],
    },
  };
};

/**
 * Har so'rovning davomiyligi va status sinfini Redis'dagi daqiqalik hash'ga
 * yozadi. Cluster'da har worker AYNAN bir xil kalitga yozadi (HINCRBY atomik),
 * shuning uchun yig'indi to'g'ri chiqadi.
 *
 * Yozish `res.on("finish")` da va `await`siz — so'rov javobi kutmaydi.
 */
const metricsMiddleware = (req, res, next) => {
  const url = req.originalUrl || req.url || "";
  if (IGNORED.some((re) => re.test(url))) return next();

  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    try {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      const statusClass = `${Math.floor(res.statusCode / 100)}xx`;
      const key = bucketKeyOf(minuteKeyOf(new Date()));

      redis
        .pipeline()
        .hincrby(key, "count", 1)
        .hincrby(key, "duration", Math.round(durationMs))
        .hincrby(key, EMPTY[statusClass] !== undefined ? statusClass : "2xx", 1)
        .expire(key, TTL_SECONDS)
        .exec()
        .catch(() => {});
    } catch {
      // metrika yozilmasa ham so'rov allaqachon javob bergan
    }
  });

  next();
};

// healthCheck.job.js chaqiradi — joriy daqiqa bucket'iga Mongo/Redis
// javob vaqtini qo'shadi (tarix grafigi uchun).
const recordHealthPing = async (mongoMs, redisMs) => {
  try {
    const key = bucketKeyOf(minuteKeyOf(new Date()));
    await redis
      .pipeline()
      .hincrby(key, "mongoMs", Math.max(0, Math.round(mongoMs)))
      .hincrby(key, "redisMs", Math.max(0, Math.round(redisMs)))
      .hincrby(key, "pings", 1)
      .expire(key, TTL_SECONDS)
      .exec();
  } catch {
    // metrika yozilmasa monitoring baribir jonli snapshotni ko'rsatadi
  }
};

module.exports = metricsMiddleware;
module.exports.recordHealthPing = recordHealthPing;
module.exports.readBuckets = readBuckets;
module.exports.recentMinuteKeys = recentMinuteKeys;
module.exports.aggregate = aggregate;
module.exports.minuteKeyOf = minuteKeyOf;
module.exports.TTL_SECONDS = TTL_SECONDS;
