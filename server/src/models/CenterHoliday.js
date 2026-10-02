const { Schema, model } = require("mongoose");
const { getNow } = require("../utils/date.util");

// Markaz (Center) darajasida "dam olish kuni" — GroupHoliday'dan farqli
// o'laroq bitta guruh emas, shu Center'ga tegishli BARCHA faol guruhlarga
// birdek ta'sir qiladi (calendar.service.js orqali har guruhga GroupHoliday
// credit-sync qilinadi). Moliyaviy yozuv emas — hard delete qilinadi.
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
  date: {
    type: String, // "YYYY-MM-DD"
    required: true,
  },
  note: {
    type: String,
    default: "",
    trim: true,
  },
  createdBy: {
    kind: {
      type: String,
      enum: ["owner", "staff"],
      required: true,
    },
    id: {
      type: Schema.Types.ObjectId,
      required: true,
    },
  },
  // Shu CenterHoliday orqali (avtomatik) GroupHoliday yaratilgan guruhlar
  // ro'yxati — unmark paytida FAQAT shu guruhlarga tegilishi uchun (foydalanuvchi
  // guruh darajasida qo'lda belgilagan GroupHoliday'larga hech qachon tegilmaydi).
  syncedGroups: {
    type: [Schema.Types.ObjectId],
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

schema.index({ center: 1, date: 1 }, { unique: true });

schema.pre("save", async function () {
  this.updatedAt = getNow();
});

module.exports = model("CenterHoliday", schema);
