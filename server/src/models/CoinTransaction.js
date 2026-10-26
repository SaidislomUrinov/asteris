const { Schema, model } = require("mongoose");
const { getNow } = require("../utils/date.util");

// WECOIN DAFTARI (API_CONTRACT_wecoin.md §1.4) — moliyaviy yozuv kabi
// HECH QACHON o'chirilmaydi. earn — oy yakuni, spend — do'kondan xarid,
// refund — xarid qaytarilgani (yangi yozuv, eskisi qoladi),
// adjust — xodim qo'lda bergan (+) / ayirgan (−) tanga (API_CONTRACT_coin_adjust.md).
const partSchema = new Schema({ count: { type: Number, default: 0 }, coins: { type: Number, default: 0 } }, { _id: false });

const schema = new Schema({
  client: { type: Schema.Types.ObjectId, ref: "Client", required: true },
  center: { type: Schema.Types.ObjectId, ref: "Center", required: true },
  student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
  type: { type: String, enum: ["earn", "spend", "refund", "adjust"], required: true },
  amount: { type: Number, required: true },
  month: { type: String, default: null }, // earn: "YYYY-MM"
  order: { type: Schema.Types.ObjectId, ref: "ShopOrder", default: null },
  breakdown: {
    type: new Schema(
      { grades: partSchema, homework: partSchema, attendance: partSchema, medals: partSchema },
      { _id: false },
    ),
    default: null,
  },
  // adjust: sabab va kim qilgani.
  reason: { type: String, default: "", maxlength: 140 },
  by: {
    type: new Schema({ id: Schema.Types.ObjectId, kind: String, name: String }, { _id: false }),
    default: null,
  },
  // earn: o'quvchi/ota-onaga oy yakuni xabari ketdimi (kunduzgi oyna, coin.service.notifyMonth).
  notified: { type: Boolean, default: false },
  createdAt: { type: Number, default: getNow },
});

// Bir oy bir filialda bir o'quvchiga BIR marta (job/skript qayta ishlasa ham).
schema.index(
  { student: 1, center: 1, month: 1 },
  { unique: true, partialFilterExpression: { type: "earn" } },
);
schema.index({ student: 1, center: 1, createdAt: -1 });
schema.index({ month: 1, type: 1, notified: 1 });

module.exports = model("CoinTransaction", schema);
