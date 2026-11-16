const { Schema, model } = require("mongoose");
const { getNow } = require("../utils/date.util");
const Quiz = require("./Quiz");

// TEST SHABLONLARI (QuizTemplate) — docs/API_CONTRACT_quiz_templates.md.
// O'qituvchining fanga bog'langan (guruh/darsga bog'lanmagan) test
// shablonlari — "Dars rejalari" sahifasidagi "Testlar" tabi. Istalgan vaqt
// shablondan foydalanib guruhiga haqiqiy `Quiz` yuboradi.
//
// `questions` sxemasi Quiz bilan AYNAN bir xil bo'lishi shart (yuborishda
// to'g'ridan-to'g'ri nusxalanadi) — shu sabab alohida nusxa yozilmaydi, Quiz
// sxemasidagi sub-schema qayta ishlatiladi (TeachingPlan/Syllabus naqsh).
const questionSchema = Quiz.schema.path("questions").schema;

const schema = new Schema({
  client: { type: Schema.Types.ObjectId, ref: "Client", required: true },
  center: { type: Schema.Types.ObjectId, ref: "Center", required: true },
  // Egasi — faqat shu o'qituvchi/yordamchi ko'radi/tahrirlaydi.
  staff: { type: Schema.Types.ObjectId, ref: "Staff", required: true },
  subject: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  questions: {
    type: [questionSchema],
    required: true,
    validate: (v) => Array.isArray(v) && v.length >= 1 && v.length <= 100,
  },
  // Yuborish paytida qayta so'raladi — shu shunchaki boshlang'ich qiymat.
  defaultDurationMin: { type: Number, default: 10 },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Number, default: null },
  createdAt: { type: Number, default: getNow },
  updatedAt: { type: Number, default: getNow },
});

// O'qituvchining o'z shablonlari ro'yxati va fan bo'yicha filtrlash uchun
// (TeachingPlan bilan bir xil naqsh).
schema.index({ client: 1, staff: 1, isDeleted: 1 });
schema.index({ client: 1, subject: 1, isDeleted: 1 });

schema.pre("save", function () {
  this.updatedAt = getNow();
});

module.exports = model("QuizTemplate", schema);
