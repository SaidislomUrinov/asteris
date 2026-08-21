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
    await this.del(key);

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
