const { Schema, model } = require("mongoose");
const { getNow } = require("../utils/date.util");

// DO'KON BUYURTMASI (API_CONTRACT_wecoin.md §1.7) — HECH QACHON o'chirilmaydi,
// faqat status o'zgaradi: pending → delivered | refunded. Mahsulot nomi/rasmi/
// narxi xarid paytidagi nusxa (mahsulot keyin o'zgarsa ham tarix to'g'ri qoladi).
const actorSchema = new Schema(
  {
    id: { type: Schema.Types.ObjectId, default: null },
    kind: { type: String, enum: ["client", "staff"], default: null },
  },
  { _id: false },
);

const schema = new Schema({
  client: { type: Schema.Types.ObjectId, ref: "Client", required: true },
  center: { type: Schema.Types.ObjectId, ref: "Center", required: true },
  student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
  product: { type: Schema.Types.ObjectId, ref: "ShopProduct", required: true },
  productName: { type: String, required: true },
  productPhoto: { type: String, default: null },
  price: { type: Number, required: true },
  status: { type: String, enum: ["pending", "delivered", "refunded"], default: "pending" },
  handledBy: { type: actorSchema, default: () => ({}) },
  handledAt: { type: Number, default: null },
  createdAt: { type: Number, default: getNow },
  updatedAt: { type: Number, default: getNow },
});

schema.index({ client: 1, center: 1, status: 1, createdAt: -1 });
schema.index({ student: 1, createdAt: -1 });

schema.pre("save", function () {
  this.updatedAt = getNow();
});

module.exports = model("ShopOrder", schema);
