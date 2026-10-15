const envConfig = require("../configs/env.config");

// Brend subdomenlari (API_CONTRACT_multi_center.md §8): CORS/socket ruxsati va
// mijoz manzilini yasash bitta joyda.

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const SUBDOMAIN_RE = new RegExp(`^https://[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.${escapeRe(envConfig.ROOT_DOMAIN)}$`);
// Dev: Chrome `*.localhost` ni qo'shimcha sozlashsiz 127.0.0.1 ga yo'naltiradi.
const DEV_SUBDOMAIN_RE = /^http:\/\/[a-z0-9-]+\.localhost(?::\d+)?$/;

const isDevApp = () => /localhost|127\.0\.0\.1/.test(envConfig.CLIENT_APP_URL || "");

/**
 * cors() va socket.io uchun `origin` callback.
 */
const corsOrigin = (origin, callback) => {
  if (!origin) return callback(null, true);
  if (envConfig.ORIGINS.includes(origin)) return callback(null, true);
  if (SUBDOMAIN_RE.test(origin)) return callback(null, true);
  if (envConfig.NODE_ENV !== "production" && DEV_SUBDOMAIN_RE.test(origin)) return callback(null, true);
  return callback(null, false);
};

/**
 * Mijoz paneli manzili: `https://{slug}.wenet.uz` (dev: `http://{slug}.localhost:5174`).
 * Slug bo'lmasa umumiy CLIENT_APP_URL.
 * @param {string|null} slug
 * @returns {string}
 */
const appUrlOf = (slug) => {
  if (!slug) return envConfig.CLIENT_APP_URL;
  if (isDevApp()) {
    const url = new URL(envConfig.CLIENT_APP_URL);
    return `${url.protocol}//${slug}.localhost${url.port ? `:${url.port}` : ""}`;
  }
  return `https://${slug}.${envConfig.ROOT_DOMAIN}`;
};

module.exports = { corsOrigin, appUrlOf };
