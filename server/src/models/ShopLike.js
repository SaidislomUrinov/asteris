const { Schema, model } = require("mongoose");
const { getNow } = require("../utils/date.util");

// O'quvchining mahsulotga "yoqdi" belgisi (API_CONTRACT_wecoin.md §1.6).
const schema = new Schema({
  product: { type: Schema.Types.ObjectId, ref: "ShopProduct", required: true },
  student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
  createdAt: { type: Number, default: getNow },
});

schema.index({ product: 1, student: 1 }, { unique: true });
schema.index({ student: 1 });

module.exports = model("ShopLike", schema);
