const { Schema, model } = require("mongoose");
const { getNow } = require("../utils/date.util");

// Yangilik o'qilganligi — har foydalanuvchi uchun alohida yozuv
// (API_CONTRACT_news.md §1). O'quvchi Client Owner yoki Staff bo'lishi
// mumkin — ular MUSTAQIL modellar, shuning uchun `refPath` emas, id + kind
// juftligi (Notification.recipient naqshi).
const schema = new Schema({
  news: { type: Schema.Types.ObjectId, ref: "News", required: true },
  reader: {
    id: { type: Schema.Types.ObjectId, required: true },
    kind: { type: String, enum: ["client", "staff"], required: true },
  },
  readAt: { type: Number, default: getNow },
});

// Idempotent "o'qildi" (upsert) — bitta foydalanuvchi bitta yangilikni bir marta.
schema.index({ news: 1, "reader.id": 1 }, { unique: true });
schema.index({ "reader.id": 1 });

module.exports = model("NewsRead", schema);
