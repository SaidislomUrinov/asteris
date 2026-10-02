const { Schema, model } = require("mongoose");
const { getNow } = require("../utils/date.util");
const Syllabus = require("./Syllabus");

// "DARS REJALARIM" — o'qituvchining fan bo'yicha shablon rejalari
// (API_CONTRACT_teaching_plans.md §2). Guruhga bog'lanmagan: guruh dasturiga
// import qilinganda To'LIQ NUSXA olinadi, shablon keyin o'zgarsa guruh
// dasturi o'zgarmaydi.
//
// Modul/dars sxemasi Syllabus bilan AYNAN bir xil bo'lishi shart (import
// shu shaklni to'g'ridan-to'g'ri nusxalaydi) — shu sabab alohida nusxa
// yozilmaydi, Syllabus sxemasidagi sub-schema qayta ishlatiladi.
const moduleSchema = Syllabus.schema.path("modules").schema;

const schema = new Schema({
  client: { type: Schema.Types.ObjectId, ref: "Client", required: true },
  center: { type: Schema.Types.ObjectId, ref: "Center", required: true },
  // Muallif (egasi) — faqat teacher/assistant.
  staff: { type: Schema.Types.ObjectId, ref: "Staff", required: true },
  subject: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  modules: { type: [moduleSchema], default: [] },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Number, default: null },
  createdAt: { type: Number, default: getNow },
  updatedAt: { type: Number, default: getNow },
});

// O'qituvchining o'z rejalari ro'yxati va import ("shu fandagi barcha
// rejalar") so'rovlari uchun.
schema.index({ client: 1, staff: 1, isDeleted: 1 });
schema.index({ client: 1, subject: 1, isDeleted: 1 });

schema.pre("save", function () {
  this.updatedAt = getNow();
});

module.exports = model("TeachingPlan", schema);
