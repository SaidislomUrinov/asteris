const redis = require("../configs/redis.config");
const { getApiBot } = require("./index");
const { bulletList } = require("./format");

// ioredis `keyPrefix: "asteris:"` ni o'zi qo'shadi — yakuniy kalit
// `asteris:alert:throttle:{type}`.
const throttleKey = (type) => `alert:throttle:${type}`;

// Bir xil turdagi ogohlantirish daqiqasiga MAX 1 marta — 5xx portlashida
// Telegram'ni minglab xabar bilan to'ldirmaslik uchun.
const THROTTLE_SECONDS = 60;

const escapeHtml = (text) =>
  String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

// Telegram xabari 4096 belgidan oshsa butunlay rad etiladi — har bir
// qiymat escape'dan OLDIN qisqartiriladi (HTML teg yarmida kesilmasin).
const VALUE_MAX = 1500;
const clipValue = (v) => {
  const str = String(v ?? "");
  return str.length > VALUE_MAX ? `${str.slice(0, VALUE_MAX)}…` : str;
};

const buildMessage = (type, { title, body, meta }) => {
  const lines = [`<b>${escapeHtml(title || type)}</b>`];
  if (body) lines.push(escapeHtml(clipValue(body)));

  if (meta && typeof meta === "object") {
    const rows = Object.entries(meta)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => `<b>${escapeHtml(k)}:</b> ${escapeHtml(clipValue(v))}`);
    if (rows.length) lines.push("", bulletList(rows));
  }

  return lines.join("\n");
};

// Bir xil xabar daqiqada takrorlanmasin. Redis ishlamasa — yuborishga
// ruxsat beriladi (ogohlantirishni yo'qotgandan ko'ra takrorlagan yaxshi).
const passThrottle = async (type) => {
  try {
    const res = await redis.set(throttleKey(type), "1", "EX", THROTTLE_SECONDS, "NX");
    return res === "OK";
  } catch {
    return true;
  }
};

/**
 * Tizim ogohlantirishini `alertChatIds` dagi barcha chatlarga yuboradi.
 *
 * FIRE-AND-FORGET: hech qachon otmaydi. Bot o'chiq / token yo'q / chat
 * ro'yxati bo'sh / hodisa turi sozlamada o'chirilgan bo'lsa — jimgina
 * `{ ok:false, skipped:true }` qaytadi.
 *
 * @param {string} type serverError | healthDegraded | subscriptionExpiring | newLead | leadStatus | test
 * @param {{title?:string, body?:string, meta?:object}} payload
 * @param {{force?:boolean, throttle?:boolean, channel?:"lead"}} options force — sozlama
 *   bayrog'i va throttle'ni chetlab o'tadi (sinov xabari uchun). channel:"lead" —
 *   `leadChatIds`ga yuboriladi (bo'sh bo'lsa `alertChatIds`ga).
 */
const sendAlert = async (type, payload = {}, options = {}) => {
  try {
    const settings = await require("../services/systemSetting.service").getRaw();
    const tg = settings?.telegram;

    if (!tg?.enabled || !tg?.botToken) return { ok: false, skipped: true, error: "alert.disabled" };

    if (!options.force && tg.alerts && tg.alerts[type] === false)
      return { ok: false, skipped: true, error: "alert.typeDisabled" };

    const leadChatIds = (tg.leadChatIds || []).filter(Boolean);
    const chatIds =
      options.channel === "lead" && leadChatIds.length
        ? leadChatIds
        : (tg.alertChatIds || []).filter(Boolean);
    if (!chatIds.length) return { ok: false, skipped: true, error: "alert.noChats" };

    if (options.throttle !== false && !options.force && !(await passThrottle(type)))
      return { ok: false, skipped: true, error: "alert.throttled" };

    const bot = await getApiBot();
    if (!bot) return { ok: false, skipped: true, error: "alert.botUnavailable" };

    const text = buildMessage(type, payload);

    // Bitta chat ishlamasa (bot bloklangan) qolganlari baribir oladi.
    const results = await Promise.allSettled(
      chatIds.map((chatId) =>
        bot.api.sendMessage(chatId, text, { parse_mode: "HTML", disable_web_page_preview: true }),
      ),
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    if (!sent) return { ok: false, error: "alert.allFailed" };

    return { ok: true, sent };
  } catch (error) {
    // Telegram tushsa ham server ishlayveradi.
    return { ok: false, error: error?.message || "alert.failed" };
  }
};

module.exports = { sendAlert };
