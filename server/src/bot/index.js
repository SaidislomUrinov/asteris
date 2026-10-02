// Telegram bot — FAQAT platforma darajasidagi texnik ogohlantirishlar uchun
// (API_CONTRACT.md §5.1). Ota-ona flow'i bu bosqichda yo'q.
//
// Muhim: bot faqat `SystemSetting.telegram.enabled === true` va token mavjud
// bo'lganda ko'tariladi. Token yo'q bo'lsa — jimgina o'tkazib yuboriladi,
// server baribir ishga tushadi.

// `grammy` ixtiyoriy bog'liqlik sifatida yuklanadi — o'rnatilmagan bo'lsa
// bot butunlay o'chiq holatda qoladi, hech qayerda xato bermaydi.
let Bot = null;
try {
  ({ Bot } = require("grammy"));
} catch {
  Bot = null;
}

const redis = require("../configs/redis.config");
const envConfig = require("../configs/env.config");
const registerCommands = require("./commands");
const { t } = require("./i18n");
const { resolveParentWebAppUrl } = require("../utils/parentWebAppUrl.util");

// Polling faqat productionda yoki aniq so'ralganda (`TELEGRAM_POLLING=1`).
// Lokal dev server prod bilan bir tokenda polling qilsa Telegram 409 Conflict
// beradi va update'lar (callback'lar ham) tasodifiy instansga tushadi —
// "inline tugmalar ishlamayapti" bugining sababi (API_CONTRACT_student_role_homework.md §6.1).
// Xabar YUBORISH (getApiBot) bunga bog'liq emas — u doim ishlaydi.
const pollingAllowed = () => envConfig.NODE_ENV === "production" || process.env.TELEGRAM_POLLING === "1";

// ioredis `keyPrefix: "asteris:"` ni o'zi qo'shadi — Redis'dagi yakuniy kalit
// `asteris:scheduler:bot:owner`.
const OWNER_LOCK_KEY = "scheduler:bot:owner";
const LOCK_TTL = 60; // soniya
const RENEW_MS = 30_000;
const CHECK_MS = 60_000;

// Xabar yuborish uchun instans (polling qilmaydi) — alert.js shuni ishlatadi.
let apiBot = null;
let apiBotToken = "";

// Polling qilayotgan instans — cluster'da FAQAT bitta worker'da bo'ladi
// (aks holda Telegram 409 Conflict beradi).
let pollingBot = null;
let pollingToken = "";
let isOwner = false;

const getTelegramSettings = async () => {
  try {
    return (
      (await require("../services/systemSetting.service").getRaw())?.telegram ||
      null
    );
  } catch {
    return null;
  }
};

/**
 * Xabar yuborish uchun bot instansi. Polling qilmaydi — faqat `bot.api`.
 * Token yo'q/o'chiq bo'lsa `null`.
 */
const getApiBot = async () => {
  if (!Bot) return null;

  const tg = await getTelegramSettings();
  if (!tg?.enabled || !tg?.botToken) return null;

  if (apiBot && apiBotToken === tg.botToken) return apiBot;

  apiBot = new Bot(tg.botToken);
  apiBotToken = tg.botToken;
  return apiBot;
};

// Bot username'i ("@asteris_bot" dagi "asteris_bot") — shaxsiy ulash
// havolasi (`t.me/{username}?start={token}`) shundan quriladi. Token
// o'zgarmasa qayta so'ralmaydi (Telegram API'ga keraksiz chaqiruv emas).
let cachedUsername = "";
let cachedUsernameToken = "";
const getBotUsername = async () => {
  const bot = await getApiBot();
  if (!bot) return null;
  if (cachedUsername && cachedUsernameToken === apiBotToken)
    return cachedUsername;
  try {
    const me = await bot.api.getMe();
    cachedUsername = me?.username || "";
    cachedUsernameToken = apiBotToken;
    return cachedUsername || null;
  } catch {
    return null;
  }
};

// Qulfni egallashga urinadi. Egallagan worker uni har 30 soniyada
// yangilab turadi — qulasa, 60 soniya ichida boshqa worker egallaydi.
const acquireOwnerLock = async () => {
  try {
    const res = await redis.set(
      OWNER_LOCK_KEY,
      String(process.pid),
      "EX",
      LOCK_TTL,
      "NX",
    );
    return res === "OK";
  } catch {
    return false;
  }
};

const renewOwnerLock = async () => {
  try {
    const owner = await redis.get(OWNER_LOCK_KEY);
    if (owner !== String(process.pid)) return false;
    await redis.expire(OWNER_LOCK_KEY, LOCK_TTL);
    return true;
  } catch {
    return false;
  }
};

const stopPolling = async () => {
  try {
    await pollingBot?.stop();
  } catch {
    // to'xtatishdagi xato ahamiyatsiz
  }
  pollingBot = null;
  pollingToken = "";
};

const startPolling = async (token) => {
  if (pollingBot && pollingToken === token) return;
  if (pollingBot) await stopPolling();
  menuButtonUrl = "";

  const bot = new Bot(token);
  registerCommands(bot);

  // Telegram menyusi ("/" tugmasi). Bitta bot — hodim ham, ota-ona ham
  // ko'radi; faqat umumiy buyruqlar. Xato bo'lsa e'tiborsiz (polling'ga
  // ta'sir qilmasin).
  bot.api
    .setMyCommands([
      { command: "start", description: "Boshlash / Начать / Start" },
      { command: "children", description: "Mening sahifam / Моя страница / My page" },
      { command: "role", description: "Rolni almashtirish / Сменить роль / Switch role" },
      { command: "lang", description: "Til / Язык / Language" },
      { command: "parent", description: "Ulanish / Подключиться / Connect" },
      { command: "unlink", description: "Botdan uzish / Отключить / Disconnect" },
    ])
    .catch((error) => console.error("bot setMyCommands:", error?.message || error));

  // grammy ichidagi xatolar serverni yiqitmasligi kerak.
  bot.catch((err) => console.error("bot:", err?.message || err));

  pollingBot = bot;
  pollingToken = token;

  // `start()` uzoq ishlaydigan promise — kutilmaydi (fire-and-forget).
  bot.start({ drop_pending_updates: true }).catch((error) => {
    // 409 Conflict — shu token bilan BOSHQA joyda (masalan lokal dev yoki
    // ikkinchi server) polling ketyapti. Aniq loglanadi (§6.1).
    const code = error?.error_code || error?.error?.error_code;
    if (code === 409 || /409|conflict/i.test(error?.message || "")) {
      console.error(
        "bot start: 409 Conflict — shu bot tokeni bilan boshqa instans polling qilyapti (dev/prod bir tokenda?). Polling to'xtatildi.",
        error?.description || error?.message || "",
      );
    } else {
      console.error("bot start:", error?.message || error);
    }
    pollingBot = null;
    pollingToken = "";
  });

  console.log(`Telegram bot polling started (pid: ${process.pid})`);
};

// Default chat menyu tugmasi → ota-ona/o'quvchi WebApp'i.
// Manzil o'zgarsa (admin sozlamani tahrirlasa) keyingi `tick` qayta qo'yadi.
let menuButtonUrl = "";
const setWebAppMenuButton = async (bot, tg = null) => {
  const url = resolveParentWebAppUrl(tg || (await getTelegramSettings()));
  if (!url) {
    console.warn("bot setChatMenuButton: parentWebAppUrl va PARENT_WEBAPP_URL https emas — menyu tugmasi qo'yilmadi");
    return;
  }
  if (url === menuButtonUrl) return;
  await bot.api.setChatMenuButton({
    menu_button: { type: "web_app", text: t("uz", "parentMenuButton"), web_app: { url } },
  });
  menuButtonUrl = url;
};

// Har daqiqada holatni tekshiradi: sozlama yoqilganmi, token o'zgardimi,
// qulf hali bizdami. Shu sabab admin sozlamani yoqsa server qayta ishga
// tushirilmasdan bot ko'tariladi.
const tick = async () => {
  if (!Bot || !pollingAllowed()) return;

  const tg = await getTelegramSettings();
  const enabled = !!tg?.enabled && !!tg?.botToken;

  if (!enabled) {
    if (pollingBot) await stopPolling();
    isOwner = false;
    return;
  }

  isOwner = isOwner ? await renewOwnerLock() : await acquireOwnerLock();

  if (!isOwner) {
    if (pollingBot) await stopPolling();
    return;
  }

  await startPolling(tg.botToken);
  // Chat menyu tugmasi — kiritish maydoni yonida doim "Dastur" (WebApp)
  // turadi (§6.3). Har tick'da, lekin faqat manzil o'zgarganda so'rov ketadi.
  if (pollingBot) {
    setWebAppMenuButton(pollingBot, tg).catch((error) => console.error("bot setChatMenuButton:", error?.message || error));
  }
};

const start = () => {
  if (!Bot) {
    console.log("Telegram bot o'chiq — `grammy` paketi o'rnatilmagan");
    return;
  }
  if (!pollingAllowed()) {
    console.log(
      `Telegram bot polling O'TKAZIB YUBORILDI: NODE_ENV=${envConfig.NODE_ENV}, TELEGRAM_POLLING!=1 ` +
        "(dev'da prod bilan 409 to'qnashuvi bo'lmasligi uchun). Yoqish: TELEGRAM_POLLING=1. Xabar yuborish ishlayveradi.",
    );
    return;
  }

  tick().catch((error) => console.error("bot tick:", error?.message || error));

  const checkTimer = setInterval(() => {
    tick().catch((error) =>
      console.error("bot tick:", error?.message || error),
    );
  }, CHECK_MS);
  checkTimer.unref?.();

  const renewTimer = setInterval(() => {
    if (isOwner) renewOwnerLock().catch(() => {});
  }, RENEW_MS);
  renewTimer.unref?.();
};

module.exports = { start, getApiBot, getBotUsername, tick };
