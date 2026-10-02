const Client = require("../models/Client");
const Student = require("../models/Student");
const redisUtil = require("../utils/redis.util");

// wenet.uz sayti uchun ochiq statistika. Asoschi qarori (2026-09-13): real
// mijozlar 10 tadan kam bo'lsa saytda kamida 10 mijoz va 2000+ o'quvchi
// ko'rsatiladi. Pastki chegara shu yerda (serverda) qo'llanadi — javobda xom
// raqam ochilib qolmasligi uchun.
const MIN_CLIENTS = 10;
const MIN_STUDENTS = 2000;
const CACHE_KEY = "stats:public";
const CACHE_TTL = 10 * 60;

module.exports = {
  publicStats: async () => {
    const cached = await redisUtil.get(CACHE_KEY);
    if (cached) return cached;

    const [clients, students] = await Promise.all([
      Client.countDocuments({ isDeleted: false }),
      Student.countDocuments({ isDeleted: false }),
    ]);

    const data =
      clients < MIN_CLIENTS
        ? { clients: MIN_CLIENTS, students: Math.max(students, MIN_STUDENTS) }
        : { clients, students };

    await redisUtil.set(CACHE_KEY, data, CACHE_TTL);
    return data;
  },
};
