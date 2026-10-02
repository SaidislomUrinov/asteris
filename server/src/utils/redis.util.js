const redis = require("../configs/redis.config");

module.exports = {
  get: async function (key) {
    const data = await redis.get(key);

    if (data === null) return null;

    try {
      const parsed = JSON.parse(data);
      return parsed;
    } catch {
      if (!isNaN(data)) return Number(data);
      return data;
    }
  },

  set: async function (key, value, expire) {
    // ESKIDA: yozishdan oldin `del(key)` chaqirilardi — ikkita ketma-ket
    // Redis round-trip orasida kalit BIR necha millisekund umuman
    // mavjud bo'lmay qolardi. Aynan shu oraliqda boshqa parallel so'rov
    // (masalan token refresh paytida SPA bir vaqtda bir nechta endpoint
    // chaqirsa) accessKey'ni o'qisa, "topilmadi" deb sessiyani noto'g'ri
    // tugagan deb hisoblardi ("auth.failed" tez-tez chiqishi shundan edi —
    // Redis TTL/eviction emas). Redis `SET key value EX seconds` o'zi
    // atomik: eski qiymat va TTL'ni bitta buyruqda almashtiradi, alohida
    // `del()` shart emas.
    let storeValue = value;

    if (typeof value === "object") {
      storeValue = JSON.stringify(value);
    }

    if (expire) {
      await redis.set(key, storeValue, "EX", expire);
    } else {
      await redis.set(key, storeValue);
    }

    return true;
  },

  del: async function (key) {
    await redis.del(key);
  },

  touch: async function (key, expire) {
    await redis.expire(key, expire);
  },
  publish: async (event, message, data) => {
    if (!event || !message || !data) return;
    await redis.publish(
      event,
      JSON.stringify({
        message,
        data,
      }),
    );
  },
};
