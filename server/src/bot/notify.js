const { getApiBot } = require("./index");
const { escapeHtml } = require("./escapeHtml");
const { resolveParentWebAppUrl } = require("../utils/parentWebAppUrl.util");

// Shaxsiy (Client/Staff) chatiga xabar — `alert.js`dagi `sendAlert`dan farqi:
// bu FIRE-AND-FORGET emas (chaqiruvchi natijani bilishi kerak bo'lishi
// mumkin), lekin xato baribir hech qachon otilmaydi — bot o'chiq/token
// yo'q/chat bloklagan bo'lsa jimgina `{ ok:false }` qaytadi. Matn chaqiruvchi
// tomonidan TO'LIQ tayyorlanadi (`bot/i18n.js`) — bu yerda faqat yuborish bor.
const sendToChat = async (chatId, text, extra = {}) => {
  if (!chatId) return { ok: false, error: "notify.noChat" };
  try {
    const bot = await getApiBot();
    if (!bot) return { ok: false, error: "notify.botUnavailable" };
    await bot.api.sendMessage(chatId, text, { parse_mode: "HTML", disable_web_page_preview: true, ...extra });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error?.message || "notify.failed" };
  }
};

// Ota-ona WebApp tugmasi ("Batafsil ko'rish") — `SystemSetting.telegram.
// parentWebAppUrl` sozlangan bo'lsa inline klaviatura, aks holda `undefined`
// (Telegram web_app tugmasi faqat https manzil bilan ishlaydi). `path` —
// ochilganda WebApp ichida qaysi sahifa (masalan `/child/:id/group/:entry`).
const parentWebAppMarkup = async (label, path = "") => {
  try {
    const tg = (await require("../services/systemSetting.service").getRaw())?.telegram;
    const base = resolveParentWebAppUrl(tg);
    if (!base) {
      // Jim `undefined` tugmasiz xabarga olib kelardi (§6.2) — sababini logga.
      console.warn("parentWebAppMarkup: parentWebAppUrl va PARENT_WEBAPP_URL https emas — tugmasiz yuboriladi");
      return undefined;
    }
    return { inline_keyboard: [[{ text: label, web_app: { url: base + path } }]] };
  } catch (error) {
    console.warn("parentWebAppMarkup: sozlamani o'qib bo'lmadi —", error?.message || error);
    return undefined;
  }
};

module.exports = { sendToChat, escapeHtml, parentWebAppMarkup };
