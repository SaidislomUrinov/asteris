const Redis = require("ioredis");
const env = require("./env.config");

const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASS,
  db: env.REDIS_DB,
  keyPrefix: env.REDIS_KEY_PREFIX,
  retryStrategy: (times) => Math.min(times * 200, 5000),
  // Redis uzilganda buyruq ~1 soniyada xato bilan qaytadi. Avval `null` edi —
  // buyruqlar Redis qaytguncha cheksiz kutardi va har so'rov (auth Redis'ni
  // o'qiydi) osilib qolardi, navbat esa xotirada o'sardi.
  maxRetriesPerRequest: 2,
  // Ulanish bor-u Redis javob bermasa ham so'rov osilib qolmasin.
  commandTimeout: 5000,
  enableReadyCheck: true,
});

redis.on("connect", () => {
  console.log(`Redis connected (pid: ${process.pid})`);
});

redis.on("error", (err) => {
  console.error(`Redis error (pid: ${process.pid}):`, err.message);
});

module.exports = redis;
