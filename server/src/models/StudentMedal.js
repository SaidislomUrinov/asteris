const { Schema, model } = require("mongoose");
const { getNow } = require("../utils/date.util");

// O'quvchining guruhdagi OYLIK REYTING MEDALI — oy yakunidagi 1/2/3-o'rin
// (oltin/kumush/bronza). Joriy oy reytingi har oy boshida reset bo'ladi, shu
// sabab o'tgan oylar natijasi shu yerda saqlanadi. Oy yakunida
// `badge.service.awardMonth` yozadi (StudentBadge bilan birga). O'CHIRILMAYDI.
const schema = new Schema({
  client: { type: Schema.Types.ObjectId, ref: "Client", required: true },
  center: { type: Schema.Types.ObjectId, ref: "Center", required: true },
  group: { type: Schema.Types.ObjectId, ref: "Group", required: true },
  student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
  month: { type: String, required: true }, // "YYYY-MM"
  position: { type: Number, required: true, min: 1, max: 3 },
  total: { type: Number, default: 0 }, // reytingdagi o'quvchilar soni
  createdAt: { type: Number, default: getNow },
});

schema.index({ student: 1, group: 1, month: 1 }, { unique: true });
schema.index({ client: 1, group: 1, month: -1 });

module.exports = model("StudentMedal", schema);
