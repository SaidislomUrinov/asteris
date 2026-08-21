const crypto = require("crypto");
const redis = require("../configs/redis.config");
const redisUtil = require("./redis.util");

// Hisobot keshi — dashboardCache.util.js bilan AYNAN bir xil naqsh.
// Hisoblar og'ir (Student.groups[] bo'ylab to'liq aylanish + Attendance
// agregatsiyasi), lekin natija bir necha daqiqa eskirsa ham zarar yo'q,
// chunki to'lov/xarajat/davomat o'zgarganda kesh darhol bekor qilinadi
// (emitter.util.js dagi CACHE_BUSTING ro'yxati).
const TTL_SECONDS = 300;

// ioredis `keyPrefix: "asteris:"` bilan sozlangan va uni get/set/del'ga
// AVTOMATIK qo'shadi — shu sabab bu yerda "asteris:" qayta yozilmaydi.
// Redis'dagi yakuniy ko'rinish: `asteris:cache:report:{client}:{hash}`.
const PREFIX = "cache:report";

// Parametrlar to'plami uzun bo'lishi mumkin (period, from, to, center,
// groupBy...) — kalit uzunligi cheklangan bo'lishi uchun qisqa hash.
const hashParams = (params = {}) => {
  const stable = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k] ?? ""}`)
    .join("&");
  return crypto.createHash("sha1").update(stable).digest("hex").slice(0, 16);
};

const keyOf = (clientId, scope, params) => `${PREFIX}:${clientId}:${scope}:${hashParams(params)}`;

// Kesh HECH QACHON ilovani to'xtatmasligi kerak — Redis ishlamasa
// chaqiruvchi oddiy hisoblashga o'tadi.
const get = async (clientId, scope, params) => {
  try {
    return await redisUtil.get(keyOf(clientId, scope, params));
  } catch {
    return null;
  }
};

const set = async (clientId, scope, params, data) => {
  try {
    await redisUtil.set(keyOf(clientId, scope, params), data, TTL_SECONDS);
  } catch {
    // yozilmasa ham javob allaqachon tayyor
  }
};

/**
 * Bitta tenantning BARCHA hisobot kalitlarini o'chiradi.
 * `KEYS` emas, `scanStream` — u butun Redis'ni bloklaydi va ko'p tenantli
 * serverda buni qilib bo'lmaydi (dashboardCache.util.js izohi).
 */
const invalidate = async (clientId) => {
  try {
    // MUHIM: ioredis `keyPrefix`ni SCAN'ning MATCH naqshiga qo'shmaydi va
    // qaytgan kalitlar prefiks BILAN keladi — naqshga prefiksni qo'lda
    // qo'shamiz, del()ga berishdan oldin esa qirqib tashlaymiz.
    const kp = redis.options.keyPrefix || "";
    const stream = redis.scanStream({ match: `${kp}${PREFIX}:${clientId}:*`, count: 100 });

    const pending = [];
    for await (const keys of stream) {
      if (!keys.length) continue;
      pending.push(redis.del(...keys.map((k) => (kp && k.startsWith(kp) ? k.slice(kp.length) : k))));
    }
    await Promise.all(pending);
  } catch {
    // invalidatsiya uddalanmasa eng yomoni — 5 daqiqa eski raqam
  }
};

module.exports = { get, set, invalidate, TTL_SECONDS };
