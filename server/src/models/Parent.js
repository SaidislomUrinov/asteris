const { Schema, model } = require("mongoose");
const { getNow } = require("../utils/date.util");
const { setTelegramPhone } = require("../utils/phone.util");

// OTA-ONA — Telegram bot orqali `request_contact` bilan ulanadi.
//
// Student'ga ref SAQLANMAYDI: farzandlar har safar `phone` bo'yicha
// rolga qarab (`parent` → `Student.parentPhone`, `student` → `Student.phone`)
// qidiriladi. Markaz o'quvchi
// kartasidagi raqamni o'zgartirsa/o'chirsa ota-ona avtomatik ko'rmay
// qoladi — sinxronizatsiya muammosi yo'q (project_parent_telegram_webapp_plan).
//
// Tenant'siz hujjat (`clientId` yo'q): ota-ona bir nechta markazning
// o'quvchilarini ko'radi — tenant izolyatsiyasi har so'rovda topilgan
// a'zolik (`Student.groups[]` entry) darajasida qo'llanadi.
const schema = new Schema({
  phone: { type: String, required: true, trim: true, set: setTelegramPhone, index: true },
  name: { type: String, default: "", trim: true },
  telegram: {
    chatId: { type: String, required: true, unique: true },
    userId: { type: String, default: null },
    lang: { type: String, enum: ["uz", "ru", "en"], default: "uz" },
    linkedAt: { type: Number, default: null },
    // Bot bloklangan (403) — xabar yuborilmaydi; /start bossa tozalanadi.
    blockedAt: { type: Number, default: null },
  },
  // Rol (API_CONTRACT_student_role_homework.md §1.1): "parent" →
  // `Student.parentPhone`, "student" → `Student.phone` bo'yicha qidiriladi.
  // `null` — hali tanlanmagan (eski hujjatlar); servis `effectiveRole`
  // orqali aniqlaydi, migratsiya kerak emas.
  role: { type: String, enum: ["parent", "student", null], default: null },
  // Qaysi xabarlar kelsin — barcha farzand/markaz uchun GLOBAL.
  mute: {
    attendance: { type: Boolean, default: false },
    lessonFinished: { type: Boolean, default: false },
    payment: { type: Boolean, default: false },
    debt: { type: Boolean, default: false },
    // O'quvchi roli uchun (darsdan 1 soat oldin eslatma, uyga vazifa).
    lessonReminder: { type: Boolean, default: false },
    homework: { type: Boolean, default: false },
    // Vazifa "Bajarmadi" (ikkala rol, API_CONTRACT_homework_missed.md).
    homeworkMissed: { type: Boolean, default: false },
    // Oylik yutuq nishonlari (ikkala rol).
    badge: { type: Boolean, default: false },
  },
  createdAt: { type: Number, default: getNow },
  updatedAt: { type: Number, default: getNow },
});

schema.pre("save", function () {
  this.updatedAt = getNow();
});

module.exports = model("Parent", schema);
