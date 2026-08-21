const crypto = require("crypto");
const redis = require("../configs/redis.config");
const keyConfig = require("../configs/key.config");
const Client = require("../models/Client");
const Staff = require("../models/Staff");
const { getBotUsername } = require("../bot");
const { sendToChat } = require("../bot/notify");
const { t } = require("../bot/i18n");
const { getNow } = require("../utils/date.util");

const LINK_TTL = 600; // 10 daqiqa — havola shuncha vaqt amal qiladi

const Model = (kind) => (kind === "client" ? Client : Staff);

// Rolga qarab tasdiqlash matni tanlanadi ("Ro'liga qarab ushbu amal nima
// vazifa bajarilishini aytadi" — API_CONTRACT.md "Telegram bog'lash").
const confirmKeyFor = (kind, role) => {
  if (kind === "client") return "linkConfirmOwner";
  if (role === "reception") return "linkConfirmReception";
  if (role === "teacher" || role === "assistant") return "linkConfirmTeacher";
  return "linkConfirmGeneric";
};

module.exports = {
  // "Telegramni ulash" bosilganda — bir martalik token generatsiya qiladi.
  startLink: async (kind, id) => {
    const token = crypto.randomBytes(16).toString("hex");
    await redis.set(keyConfig.telegramLinkToken(token), JSON.stringify({ kind, id: String(id) }), "EX", LINK_TTL);

    const username = await getBotUsername();
    return {
      token,
      botUsername: username,
      deepLink: username ? `https://t.me/${username}?start=${token}` : null,
      expiresInSeconds: LINK_TTL,
    };
  },

  // Bot `/start {token}` qabul qilganda chaqiriladi — havolani hal qiladi,
  // Client/Staff hujjatiga `chatId`ni yozadi va tasdiqlash matnini qaytaradi.
  resolveLink: async (token, chatId) => {
    const raw = await redis.get(keyConfig.telegramLinkToken(token));
    if (!raw) return { ok: false, message: t("uz", "linkExpired") };

    await redis.del(keyConfig.telegramLinkToken(token));
    const { kind, id } = JSON.parse(raw);

    const doc = await Model(kind).findOne({ _id: id, isDeleted: false });
    if (!doc) return { ok: false, message: t("uz", "linkExpired") };

    doc.telegram = { ...(doc.telegram || {}), chatId: String(chatId), linkedAt: getNow() };
    await doc.save();

    const lang = doc.telegram?.lang || "uz";
    const message = t(lang, confirmKeyFor(kind, doc.role));
    return { ok: true, message };
  },

  status: async (kind, id) => {
    const doc = await Model(kind).findOne({ _id: id }).select("telegram");
    return {
      linked: !!doc?.telegram?.chatId,
      lang: doc?.telegram?.lang || "uz",
    };
  },

  unlink: async (kind, id) => {
    await Model(kind).updateOne({ _id: id }, { $set: { "telegram.chatId": null, "telegram.linkedAt": null } });
    return { ok: true };
  },

  setLang: async (kind, id, lang) => {
    if (!["uz", "ru", "en"].includes(lang)) throw new Error("telegram.invalidLang");
    await Model(kind).updateOne({ _id: id }, { $set: { "telegram.lang": lang } });
    return { ok: true, lang };
  },

  // Boshqa modullar (jobs) shu orqali yuboradi — chatId yo'q bo'lsa jimgina
  // o'tkazib yuboriladi (linkatanmagan foydalanuvchi uchun xato emas).
  sendIfLinked: async (kind, id, buildText) => {
    const doc = await Model(kind).findOne({ _id: id }).select("telegram");
    const chatId = doc?.telegram?.chatId;
    if (!chatId) return { ok: false, skipped: true };
    const lang = doc?.telegram?.lang || "uz";
    return sendToChat(chatId, buildText(lang));
  },
};
