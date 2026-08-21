const { Schema, model } = require("mongoose");
const { getNow } = require("../utils/date.util");

// O'qituvchi qo'ygan baho (1–5). Bitta o'quvchiga bitta kunda bitta guruh
// bo'yicha BITTA baho — qayta qo'yilsa eskisi yangilanadi (unique index).
// Sana "YYYY-MM-DD" (Asia/Tashkent kalendar kuni) — davomat bilan bir xil
// naqsh, shuning uchun oylik jadvalda ular yonma-yon turadi.
const schema = new Schema({
  client: { type: Schema.Types.ObjectId, ref: "Client", required: true },
  center: { type: Schema.Types.ObjectId, ref: "Center", required: true },
  group: { type: Schema.Types.ObjectId, ref: "Group", required: true },
  student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
  // Kim qo'ygani — o'qituvchi (yoki menejer). Audit uchun.
  teacher: { type: Schema.Types.ObjectId, ref: "Staff", default: null },
  date: { type: String, required: true },
  value: { type: Number, required: true, min: 1, max: 5 },
  note: { type: String, default: "", trim: true },
  createdAt: { type: Number, default: getNow },
  updatedAt: { type: Number, default: getNow },
});

schema.index({ group: 1, student: 1, date: 1 }, { unique: true });
schema.index({ group: 1, date: 1 });
schema.index({ student: 1, createdAt: -1 });

schema.pre("save", function () {
  this.updatedAt = getNow();
});

module.exports = model("Grade", schema);
