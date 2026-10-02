const { Schema, model } = require("mongoose");
const { getNow } = require("../utils/date.util");

// Bildirishnoma. Qabul qiluvchi Client Owner, Staff yoki Parent (ota-ona,
// Telegram) bo'lishi mumkin —
// ular MUSTAQIL modellar (CLAUDE.md "Autentifikatsiya"), shuning uchun
// `refPath` emas, id + kind juftligi (Payment.collectedBy bilan bir xil naqsh).
const schema = new Schema({
  client: { type: Schema.Types.ObjectId, ref: "Client", required: true },
  center: { type: Schema.Types.ObjectId, ref: "Center", default: null },
  recipient: {
    id: { type: Schema.Types.ObjectId, required: true },
    kind: { type: String, enum: ["client", "staff", "parent"], required: true },
  },
  // "lesson:reminder" — darsga 1 soat qolganda; keyinchalik boshqa turlar.
  type: { type: String, required: true },
  title: { type: String, required: true },
  body: { type: String, default: "" },
  // Bosilganda qayerga o'tish uchun (masalan { groupId })
  data: { type: Object, default: {} },
  read: { type: Boolean, default: false },
  readAt: { type: Number, default: null },
  createdAt: { type: Number, default: getNow },
});

schema.index({ "recipient.id": 1, createdAt: -1 });
schema.index({ "recipient.id": 1, read: 1 });
// Bir xil eslatma ikki marta yuborilmasin (dedup kaliti bo'lgan turlar uchun)
schema.index({ dedupKey: 1 }, { unique: true, sparse: true });
schema.add({ dedupKey: { type: String, default: null } });

module.exports = model("Notification", schema);
