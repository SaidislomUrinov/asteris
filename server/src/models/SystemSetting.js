const { Schema, model } = require("mongoose");
const { getNow } = require("../utils/date.util");

// Platforma darajasidagi YAGONA (singleton) sozlama hujjati — tenantga
// bog'liq emas, faqat Platform Admin tahrirlaydi. `key: "global"` unique
// bo'lgani uchun ikkinchi hujjat yaratib bo'lmaydi.
const schema = new Schema({
  key: {
    type: String,
    default: "global",
    unique: true,
  },

  smtp: {
    enabled: { type: Boolean, default: false },
    host: { type: String, default: "" },
    port: { type: Number, default: 465 },
    secure: { type: Boolean, default: true },
    user: { type: String, default: "" },
    // MAXFIY — DTO'da hech qachon ochiq qaytmaydi (hasPassword bayrog'i bilan).
    pass: { type: String, default: "" },
    fromName: { type: String, default: "WENET" },
    fromEmail: { type: String, default: "" },
  },

  telegram: {
    enabled: { type: Boolean, default: false },
    // MAXFIY — DTO'da maskalanadi.
    botToken: { type: String, default: "" },
    // Tizim ogohlantirishlari boradigan chatlar (bot /chatid orqali topiladi).
    alertChatIds: { type: [String], default: [] },
    // Lead xabarlari (yangi lead + status o'zgarishi) boradigan chatlar —
    // reklama/sotuv jamoasi uchun. Bo'sh bo'lsa `alertChatIds`ga ketadi.
    leadChatIds: { type: [String], default: [] },
    // Ota-ona Telegram WebApp manzili (https). Bo'sh bo'lsa bot xabarlarida
    // "Batafsil ko'rish" tugmasi chiqmaydi.
    parentWebAppUrl: { type: String, default: "" },
    alerts: {
      serverError: { type: Boolean, default: true },
      healthDegraded: { type: Boolean, default: true },
      subscriptionExpiring: { type: Boolean, default: true },
      newLead: { type: Boolean, default: true },
      leadStatus: { type: Boolean, default: true },
    },
  },

  storage: {
    driver: { type: String, enum: ["local", "s3"], default: "local" },
    baseUrl: { type: String, default: "" },
    maxFileMb: { type: Number, default: 10 },
  },

  backup: {
    enabled: { type: Boolean, default: false },
    // "HH:mm" — kuniga bir marta shu vaqtda (Asia/Tashkent).
    cron: { type: String, default: "03:00" },
    keepDays: { type: Number, default: 7 },
    lastRunAt: { type: Number, default: null },
    lastStatus: { type: String, default: "" },
  },

  createdAt: {
    type: Number,
    default: getNow,
  },
  updatedAt: {
    type: Number,
    default: getNow,
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: "Admin",
    default: null,
  },
});

module.exports = model("SystemSetting", schema);
