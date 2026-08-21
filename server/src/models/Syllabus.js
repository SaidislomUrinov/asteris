const { Schema, model } = require("mongoose");
const { getNow } = require("../utils/date.util");

// KURS DASTURI — guruhga xos modul/dars daraxti.
//
// `Group` hujjatiga EMBED QILINMAYDI: Group ro'yxat/jadval/dashboard
// so'rovlarida hamma joyda yuklanadi, modul daraxti esa payloadni bir necha
// barobar shishirardi. Shu sabab alohida collection — bitta guruh = bitta
// hujjat (`group` unique).
//
// Darsda "bajarildi" belgisi YO'Q: progress Attendance dagi unikal
// sanalardan AVTOMATIK hisoblanadi (utils/syllabusProgress.util.js), hech
// kim hech narsa bosmaydi. 2026-08-04 da `done`/`doneAt` ataylab olib
// tashlangan edi — o'sha qaror shu yerda ham saqlanadi.
const lessonSchema = new Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: "", trim: true },
  homework: { type: String, default: "", trim: true },
});

// Modul faqat GURUHLASH vositasi — nazorat ishi, blok yoki "o'tish sharti"
// mantiqi yo'q.
const moduleSchema = new Schema({
  title: { type: String, required: true, trim: true },
  lessons: { type: [lessonSchema], default: [] },
});

const schema = new Schema({
  client: { type: Schema.Types.ObjectId, ref: "Client", required: true },
  center: { type: Schema.Types.ObjectId, ref: "Center", required: true },
  group: { type: Schema.Types.ObjectId, ref: "Group", required: true, unique: true },
  modules: { type: [moduleSchema], default: [] },
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Number, default: getNow },
  updatedAt: { type: Number, default: getNow },
});

// Tenant izolyatsiyasi — har query'da `client` filtri bor.
schema.index({ client: 1 });

schema.pre("save", function () {
  this.updatedAt = getNow();
});

module.exports = model("Syllabus", schema);
