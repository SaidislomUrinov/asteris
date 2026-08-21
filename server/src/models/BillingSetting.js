const { Schema, model } = require("mongoose");
const { getNow } = require("../utils/date.util");

// Har FILIAL (Center) uchun bitta hujjat — guruh oylik to'lov sikli qanday
// hisoblanishini belgilaydi (CenterDetail sahifasi, "To'lov sikli"). Center
// darajasida, chunki har filial o'z sikl qoidasini tanlashi kerak:
// - "anchor": "sanadan-sanaga" — sikl guruh faollashtirilgan kun-oyga
//   langar (masalan 17-dan boshlansa, har sikl 17-dan 17-gacha). Hozirgi
//   standart xatti-harakat (student.service.js "computeBilling").
// - "calendarMonth": "oy boshidan oy boshiga" — birinchi sikl faollashgan
//   kundan o'sha oy oxirigacha (kun soniga qarab prorata), keyingi har bir
//   sikl kalendar oyning 1-sanasidan 1-sanagacha, to'liq narxda.
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
    unique: true,
  },
  cycleMode: {
    type: String,
    enum: ["anchor", "calendarMonth"],
    default: "anchor",
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

schema.pre("save", async function () {
  this.updatedAt = getNow();
});

module.exports = model("BillingSetting", schema);
