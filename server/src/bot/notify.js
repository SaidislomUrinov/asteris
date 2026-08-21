const { getApiBot } = require("./index");

const escapeHtml = (text) =>
  String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

// Shaxsiy (Client/Staff) chatiga xabar — `alert.js`dagi `sendAlert`dan farqi:
// bu FIRE-AND-FORGET emas (chaqiruvchi natijani bilishi kerak bo'lishi
// mumkin), lekin xato baribir hech qachon otilmaydi — bot o'chiq/token
// yo'q/chat bloklagan bo'lsa jimgina `{ ok:false }` qaytadi. Matn chaqiruvchi
// tomonidan TO'LIQ tayyorlanadi (`bot/i18n.js`) — bu yerda faqat yuborish bor.
const sendToChat = async (chatId, text) => {
  if (!chatId) return { ok: false, error: "notify.noChat" };
  try {
    const bot = await getApiBot();
    if (!bot) return { ok: false, error: "notify.botUnavailable" };
    await bot.api.sendMessage(chatId, text, { parse_mode: "HTML", disable_web_page_preview: true });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error?.message || "notify.failed" };
  }
};

module.exports = { sendToChat, escapeHtml };
