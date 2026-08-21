const redis = require("../configs/redis.config");
const redisUtil = require("./redis.util");

// Dashboard keshining amal qilish muddati. Qiymat ataylab qisqa: raqamlar
// jonli ko'rinishi kerak, lekin QR davomat oqimida (har skanda socket hodisa
// → frontend qayta so'raydi) bir xil og'ir hisob soniyada o'nlab marta
// takrorlanmasligi shart — API_CONTRACT_performance.md §3.
const TTL_SECONDS = 60;

// ioredis `keyPrefix: "asteris:"` bilan sozlangan (configs/redis.config.js) va
// uni get/set/del'ga AVTOMATIK qo'shadi. Shuning uchun bu yerda "asteris:" ni
// qayta yozib bo'lmaydi — aks holda kalit `asteris:asteris:...` bo'lib qolardi.
// Redis'dagi yakuniy ko'rinish: `asteris:cache:dashboard:{client}:{center}:{oy}`
// — CLAUDE.md dagi kalit naqshiga aynan mos.
const PREFIX = "cache:dashboard";

const keyOf = (clientId, center, month) =>
  `${PREFIX}:${clientId}:${center || "all"}:${month}`;

/**
 * Keshdan o'qiydi. Redis ishlamasa `null` qaytaradi — ya'ni chaqiruvchi
 * oddiy hisoblashga o'tadi. Kesh HECH QACHON ilovani to'xtatmasligi kerak.
 */
const get = async (clientId, center, month) => {
  try {
    return await redisUtil.get(keyOf(clientId, center, month));
  } catch {
    return null;
  }
};

const set = async (clientId, center, month, data) => {
  try {
    await redisUtil.set(keyOf(clientId, center, month), data, TTL_SECONDS);
  } catch {
    // kesh yozilmasa ham javob allaqachon tayyor — jim o'tkazamiz
  }
};

/**
 * Bitta tenantning BARCHA dashboard kalitlarini o'chiradi (hamma markaz,
 * hamma oy). To'lov/xarajat/davomat/oylik o'zgarganda chaqiriladi, aks holda
 * foydalanuvchi 60 soniyagacha eskirgan raqam ko'rardi.
 *
 * `scanStream` ishlatiladi — `KEYS` butun Redis'ni bloklaydi va ko'p
 * tenantli serverda buni qilib bo'lmaydi.
 */
const invalidate = async (clientId) => {
  try {
    // MUHIM: ioredis `keyPrefix`ni SCAN'ning MATCH naqshiga qo'shmaydi va
    // qaytgan kalitlar prefiks BILAN keladi. Shuning uchun naqshga prefiksni
    // qo'lda qo'shamiz, del()ga berishdan oldin esa qirqib tashlaymiz —
    // aks holda del ikkinchi marta prefikslab, hech narsa o'chmaydi.
    const kp = redis.options.keyPrefix || "";
    const stream = redis.scanStream({ match: `${kp}${PREFIX}:${clientId}:*`, count: 100 });

    const pending = [];
    for await (const keys of stream) {
      if (!keys.length) continue;
      pending.push(redis.del(...keys.map((k) => (kp && k.startsWith(kp) ? k.slice(kp.length) : k))));
    }
    await Promise.all(pending);
  } catch {
    // invalidatsiya uddalanmasa eng yomoni — 60 soniya eski raqam
  }
};

module.exports = { get, set, invalidate, TTL_SECONDS };
