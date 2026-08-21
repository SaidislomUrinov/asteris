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
const registerCommands = require("./commands");

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
    return (await require("../services/systemSetting.service").getRaw())?.telegram || null;
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
  if (cachedUsername && cachedUsernameToken === apiBotToken) return cachedUsername;
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
    const res = await redis.set(OWNER_LOCK_KEY, String(process.pid), "EX", LOCK_TTL, "NX");
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

  const bot = new Bot(token);
  registerCommands(bot);

  // grammy ichidagi xatolar serverni yiqitmasligi kerak.
  bot.catch((err) => console.error("bot:", err?.message || err));

  pollingBot = bot;
  pollingToken = token;

  // `start()` uzoq ishlaydigan promise — kutilmaydi (fire-and-forget).
  bot.start({ drop_pending_updates: true }).catch((error) => {
    console.error("bot start:", error?.message || error);
    pollingBot = null;
    pollingToken = "";
  });

  console.log(`Telegram bot polling started (pid: ${process.pid})`);
};

// Har daqiqada holatni tekshiradi: sozlama yoqilganmi, token o'zgardimi,
// qulf hali bizdami. Shu sabab admin sozlamani yoqsa server qayta ishga
// tushirilmasdan bot ko'tariladi.
const tick = async () => {
  if (!Bot) return;

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
};

const start = () => {
  if (!Bot) {
    console.log("Telegram bot o'chiq — `grammy` paketi o'rnatilmagan");
    return;
  }

  tick().catch((error) => console.error("bot tick:", error?.message || error));

  const checkTimer = setInterval(() => {
    tick().catch((error) => console.error("bot tick:", error?.message || error));
  }, CHECK_MS);
  checkTimer.unref?.();

  const renewTimer = setInterval(() => {
    if (isOwner) renewOwnerLock().catch(() => {});
  }, RENEW_MS);
  renewTimer.unref?.();
};

module.exports = { start, getApiBot, getBotUsername, tick };
