const envConfig = require("../configs/env.config");

const clean = (url) => String(url || "").trim().replace(/\/$/, "");
const isHttps = (url) => /^https:\/\//.test(url);

// Ota-ona WebApp'ining yakuniy manzili: admin sozlamasi → `PARENT_WEBAPP_URL`.
// Telegram `web_app` tugmasi faqat https bilan ishlaydi — hech biri mos
// bo'lmasa "" qaytadi (chaqiruvchi tugmasiz yuboradi).
const resolveParentWebAppUrl = (tg) => {
  const fromSettings = clean(tg?.parentWebAppUrl);
  if (isHttps(fromSettings)) return fromSettings;
  const fromEnv = clean(envConfig.PARENT_WEBAPP_URL);
  return isHttps(fromEnv) ? fromEnv : "";
};

module.exports = { resolveParentWebAppUrl };
