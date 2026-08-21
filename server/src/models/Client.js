const { Schema, model } = require("mongoose");
const { getNow, formatDate } = require("../utils/date.util");
const Counter = require("./Counter");

const schema = new Schema({
  clientId: {
    type: Number,
    unique: true,
  }, // increment, hech qachon qayta ishlatilmaydi (Counter orqali)
  name: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    trim: true,
  }, // hash.util.js orqali generatsiya qilingan hash
  // Tizim xatlari uchun (welcome, obuna tugashi haqida ogohlantirish).
  // Bo'sh bo'lsa — email jimgina o'tkazib yuboriladi.
  email: {
    type: String,
    default: "",
    trim: true,
  },
  lead: {
    type: Schema.Types.ObjectId,
    ref: "Lead",
    default: null,
  },
  blocked: {
    type: Boolean,
    default: false,
  },
  subscription: {
    type: Schema.Types.ObjectId,
    ref: "Subscription",
    default: null,
  }, // joriy FAOL obunaga tez pointer — to'liq tarix Subscription kolleksiyasida
  trialUsed: {
    type: Boolean,
    default: false,
  }, // tekin sinov muddatidan bir marta foydalanilgach true bo'ladi, qayta berilmaydi
  // Shaxsiy Telegram bog'lanishi — platforma botiga (SystemSetting.telegram)
  // "/start {token}" orqali ulaydi. Bir bot, ko'p foydalanuvchi: `chatId`
  // faqat shu hujjatga tegishli, boshqa Client/Staff'ning bog'lanishiga
  // umuman ta'sir qilmaydi (API_CONTRACT.md "Telegram bog'lash").
  telegram: {
    chatId: { type: String, default: null },
    lang: { type: String, enum: ["uz", "ru", "en"], default: "uz" },
    linkedAt: { type: Number, default: null },
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  deletedAt: {
    type: Number,
    default: null,
  },
  createdAt: {
    type: Number,
    default: getNow,
  },
  updatedAt: {
    type: Number,
    default: getNow,
  },
});

// Faqat aktiv (isDeleted:false) hujjatlar orasida unique — soft-delete qilingan
// mijozning raqami keyinchalik qayta ro'yxatdan o'tkazilishi mumkin bo'lishi kerak.
schema.index({ phone: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });

schema.pre("save", async function () {
  this.updatedAt = getNow();
  if (this.isNew && this.clientId == null) {
    this.clientId = await Counter.next("client");
  }
});

schema.virtual("date").get(function () {
  return formatDate(this.createdAt);
});

schema.virtual("lastUpdate").get(function () {
  return formatDate(this.updatedAt);
});

module.exports = model("Client", schema);
