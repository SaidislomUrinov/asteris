const { Schema, model } = require("mongoose");
const { getNow } = require("../utils/date.util");

// Har bir SMS (qabul qiluvchi) uchun bitta yozuv.
const schema = new Schema({
  batch: { type: Schema.Types.ObjectId, ref: "SmsBatch", default: null },
  client: { type: Schema.Types.ObjectId, ref: "Client", default: null },
  center: { type: Schema.Types.ObjectId, ref: "Center", default: null },
  student: { type: Schema.Types.ObjectId, ref: "Student", default: null },
  studentName: { type: String, default: "" },
  phone: { type: String, default: "" },
  text: { type: String, default: "" },
  segments: { type: Number, default: 1 }, // balansdan yechilgan qism soni
  // queued → sent (shlyuz qabul qildi) → delivered | failed; skipped = raqam yo'q.
  status: { type: String, enum: ["queued", "sent", "delivered", "failed", "skipped"], default: "queued" },
  error: { type: String, default: "" },
  requestId: { type: String, default: "" },
  isTest: { type: Boolean, default: false }, // admin test yuborishi
  sentAt: { type: Number, default: null },
  deliveredAt: { type: Number, default: null },
  createdAt: { type: Number, default: getNow },
});

schema.index({ batch: 1, status: 1 });
schema.index({ status: 1, createdAt: 1 });

module.exports = model("SmsLog", schema);
