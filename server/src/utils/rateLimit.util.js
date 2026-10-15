// express-rate-limit o'rami — chegaradan oshganda oddiy matn ("Too many
// requests") emas, API konvensiyasidagi JSON qaytaradi (`{ ok:false, msg }`),
// frontend uni i18n kaliti sifatida tarjima qiladi. Imzo asl `rateLimit`
// bilan bir xil — route fayllarida faqat `require` yo'li almashtirilgan.
//
// Hisoblagich REDIS'da (barcha cluster worker'lari uchun umumiy). Avval
// standart xotira store'i edi — prodda har worker o'z hisobini yuritardi va
// "15 daqiqada 10 urinish" amalda 10 × worker soni bo'lib qolardi.
// Redis ishlamasa so'rov o'tkaziladi (`passOnStoreError`) — limiter butun
// API'ni yiqitmasin.
const rateLimit = require("express-rate-limit");
const redis = require("../configs/redis.config");

// INCR + birinchi urinishda TTL — atomar (Lua), poyga yo'q.
const INCR_SCRIPT = `
local c = redis.call('INCR', KEYS[1])
if c == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) ttl = tonumber(ARGV[1]) end
return {c, ttl}`;

// Har limiter o'z prefiksiga ega bo'lishi shart (express-rate-limit bitta
// store'ni ikki limiterda ishlatishni taqiqlaydi). Prefiks — modul yuklanish
// tartibidagi raqam: barcha worker'larda kod bir xil, demak raqam ham bir xil.
let seq = 0;

class RedisStore {
  constructor(name) {
    this.prefix = `ratelimit:${name}:`;
    this.localKeys = false;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  async increment(key) {
    const [totalHits, ttl] = await redis.eval(INCR_SCRIPT, 1, this.prefix + key, this.windowMs);
    return { totalHits: Number(totalHits), resetTime: new Date(Date.now() + Number(ttl)) };
  }

  async decrement(key) {
    await redis.decr(this.prefix + key);
  }

  async resetKey(key) {
    await redis.del(this.prefix + key);
  }
}

module.exports = (options = {}) => {
  const { name, ...rest } = options;
  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    ...rest,
    store: new RedisStore(name || `l${++seq}`),
    passOnStoreError: true,
    // Status 200 — loyiha konvensiyasi (frontend `ok:false`ni o'qiydi; 429 da
    // axios xatoni "aloqa yo'q" deb ko'rsatardi).
    handler: (req, res) => res.send({ ok: false, msg: "common.tooManyRequests" }),
  });
};

// IPv6 manzilini /56 subnetga keltiradi (express-rate-limit tavsiyasi) —
// custom `keyGenerator`larda req.ip o'rniga shu ishlatiladi.
module.exports.ipKey = (req) => rateLimit.ipKeyGenerator(req.ip || "");
