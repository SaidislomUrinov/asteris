const { Schema, model } = require("mongoose");
const { getNow } = require("../utils/date.util");

// UYGA VAZIFA (API_CONTRACT_student_role_homework.md §1.2) — guruh + sana
// bo'yicha BITTA matn. O'qituvchi/assistent client panelida yozadi, o'quvchi
// WebApp'da ko'radi. Sana "YYYY-MM-DD" (Asia/Tashkent kalendar kuni) —
// Grade/Attendance bilan bir xil naqsh.
//
// Kurs dasturidagi `Syllabus.lessons[].homework` bundan MUSTAQIL — u faqat
// UI'da placeholder/prefill sifatida taklif qilinadi.
const actorSchema = new Schema(
  {
    id: { type: Schema.Types.ObjectId, default: null },
    kind: { type: String, enum: ["client", "staff"], default: null },
  },
  { _id: false },
);

// O'quvchining shu vazifa bo'yicha natijasi (API_CONTRACT_wecoin.md §1.1) —
// o'qituvchi belgilaydi. Oy yakunida WECOIN hisobiga ham kiradi.
const resultSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    status: { type: String, enum: ["done", "partial", "missed"], required: true },
    updatedAt: { type: Number, default: getNow },
  },
  { _id: false },
);

const schema = new Schema({
  client: { type: Schema.Types.ObjectId, ref: "Client", required: true },
  center: { type: Schema.Types.ObjectId, ref: "Center", required: true },
  group: { type: Schema.Types.ObjectId, ref: "Group", required: true },
  date: { type: String, required: true },
  text: { type: String, required: true, trim: true, maxlength: 2000 },
  results: { type: [resultSchema], default: [] },
  // Kim yozgani — `collectedBy` naqshi (id + kind), refPath emas.
  createdBy: { type: actorSchema, default: () => ({}) },
  updatedBy: { type: actorSchema, default: () => ({}) },
  // Soft delete — bo'sh matn yuborilganda.
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Number, default: null },
  createdAt: { type: Number, default: getNow },
  updatedAt: { type: Number, default: getNow },
});

// Bir guruhda bir kunga bitta (aktiv) vazifa. O'chirilganlar indeksdan
// tashqarida — o'sha kunga qayta yozish mumkin.
schema.index({ group: 1, date: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });
schema.index({ client: 1, center: 1, group: 1, date: -1 });

schema.pre("save", function () {
  this.updatedAt = getNow();
});

module.exports = model("Homework", schema);
