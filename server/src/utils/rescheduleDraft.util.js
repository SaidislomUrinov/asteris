const redisUtil = require("./redis.util");

// Qayta tartiblash seansi — VAQTINCHALIK ish holati, doimiy biznes-ma'lumot
// emas. Shuning uchun Mongoose modeli ochilmadi: soft-delete, audit va
// migratsiya yuki keraksiz, holbuki yozuv bir soatdan keyin ahamiyatsiz.
// API_CONTRACT_group_reschedule.md.
//
// ioredis `keyPrefix: "asteris:"` ni O'ZI qo'shadi (configs/redis.config.js),
// shuning uchun bu yerda "asteris:" qayta yozilmaydi — aks holda kalit
// `asteris:asteris:...` bo'lib qolardi.
const TTL_SECONDS = 2 * 60 * 60;

const keyOf = (clientId, userId) => `reschedule:${clientId}:${userId}`;

const get = async (clientId, userId) => {
  try {
    return await redisUtil.get(keyOf(clientId, userId));
  } catch {
    return null;
  }
};

const save = async (clientId, userId, draft) => {
  await redisUtil.set(keyOf(clientId, userId), draft, TTL_SECONDS);
  return draft;
};

const remove = async (clientId, userId) => {
  try {
    await redisUtil.del(keyOf(clientId, userId));
  } catch {
    // qoralama o'chmasa ham TTL bilan o'zi yo'qoladi
  }
};

module.exports = { get, save, remove, TTL_SECONDS };
