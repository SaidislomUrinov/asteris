const { Schema, model } = require("mongoose");
const { getNow } = require("../utils/date.util");

const recordSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    status: { type: String, enum: ["present", "absent", "excused"], required: true },
    reason: { type: String, default: "", trim: true },
    // Kechikish ALOHIDA bayroq, status emas — kechikkan o'quvchi baribir
    // "present" (darsga kelgan), shuning uchun statistika, to'lov krediti va
    // maosh hisobi o'zgarmasdan qolaveradi. Yangi status qo'shilsa, shu uch
    // joyning hammasi buzilardi.
    late: { type: Boolean, default: false },
    // Yozuv QR skan orqali kelganmi yoki qo'lda belgilanganmi — audit uchun.
    source: { type: String, enum: ["manual", "qr", "face"], default: "manual" },
  },
  { _id: false },
);

// Har (guruh, sana) juftligi uchun bitta sessiya — bir kunlik darsning
// barcha o'quvchilar davomati shu yerda to'planadi. Faqat JORIY kun uchun
// yoziladi (backfill yo'q, MVP qamrovi — API_CONTRACT_attendance.md).
const schema = new Schema({
  client: {
    type: Schema.Types.ObjectId,
    ref: "Client",
    required: true,
  },
  center: {
    type: Schema.Types.ObjectId,
    ref: "Center",
    required: true,
  },
  group: {
    type: Schema.Types.ObjectId,
    ref: "Group",
    required: true,
  },
  date: {
    type: String, // "YYYY-MM-DD" (Asia/Tashkent)
    required: true,
  },
  records: {
    type: [recordSchema],
    default: [],
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

schema.index({ group: 1, date: 1 }, { unique: true });

schema.pre("save", async function () {
  this.updatedAt = getNow();
});

// Tenant izolyatsiyasi indeksi — API_CONTRACT_performance.md §1
schema.index({ client: 1, date: 1 });
schema.index({ client: 1, center: 1, date: 1 });

module.exports = model("Attendance", schema);
