const { Schema, model } = require("mongoose");
const { getNow } = require("../utils/date.util");

// FILIAL DO'KONI MAHSULOTI (API_CONTRACT_wecoin.md §1.5) — narx WECOIN'da.
// "O'chirish" = soft delete; mavjud buyurtmalar nusxa (nom/rasm/narx) saqlaydi.
const schema = new Schema({
  client: { type: Schema.Types.ObjectId, ref: "Client", required: true },
  center: { type: Schema.Types.ObjectId, ref: "Center", required: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  price: { type: Number, required: true, min: 1, max: 100000 },
  photo: { type: String, default: null },
  // null — cheklanmagan; son bo'lsa har xaridda -1, qaytarilsa +1.
  stock: { type: Number, default: null, min: 0 },
  isActive: { type: Boolean, default: true },
  likes: { type: Number, default: 0, min: 0 },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Number, default: null },
  createdAt: { type: Number, default: getNow },
  updatedAt: { type: Number, default: getNow },
});

schema.index({ client: 1, center: 1, isDeleted: 1, createdAt: -1 });

schema.pre("save", function () {
  this.updatedAt = getNow();
});

module.exports = model("ShopProduct", schema);
