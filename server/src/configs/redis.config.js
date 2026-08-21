const Redis = require("ioredis");
const env = require("./env.config");

const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASS,
  db: env.REDIS_DB,
  keyPrefix: env.REDIS_KEY_PREFIX,
  retryStrategy: (times) => Math.min(times * 200, 5000),
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

redis.on("connect", () => {
  console.log(`Redis connected (pid: ${process.pid})`);
});

redis.on("error", (err) => {
  console.error(`Redis error (pid: ${process.pid}):`, err.message);
});

module.exports = redis;
