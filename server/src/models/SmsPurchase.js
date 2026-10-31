const { Schema, model } = require("mongoose");
const { getNow } = require("../utils/date.util");

// Sotib olingan SMS paket — moliyaviy yozuv, HECH QACHON o'chirilmaydi.
// `remaining` pending paytida 0; to'lov tasdiqlanganda `smsCount` ga o'rnatiladi.
const schema = new Schema({
  client: { type: Schema.Types.ObjectId, ref: "Client", required: true },
  center: { type: Schema.Types.ObjectId, ref: "Center", required: true }, // balans filial darajasida
  package: { type: Schema.Types.ObjectId, ref: "SmsPackage", default: null },
  packageName: { type: String, default: "" }, // snapshot
  smsCount: { type: Number, required: true },
  remaining: { type: Number, default: 0 },
  price: { type: Number, required: true },
  validityDays: { type: Number, default: 30 },
  orderId: { type: String, required: true, unique: true }, // inPAY order_id
  payUrl: { type: String, default: "" },
  status: { type: String, enum: ["pending", "paid", "cancelled", "failed"], default: "pending" },
  paidAt: { type: Number, default: null },
  expiresAt: { type: Number, default: null }, // unix | null (cheksiz)
  expiredLogged: { type: Boolean, default: false }, // `expire` tranzaksiyasi yozilganmi
  createdAt: { type: Number, default: getNow },
  updatedAt: { type: Number, default: getNow },
});

schema.index({ client: 1, center: 1, status: 1, expiresAt: 1 });
schema.index({ client: 1, center: 1, createdAt: -1 });
schema.index({ status: 1, expiresAt: 1, expiredLogged: 1 });

module.exports = model("SmsPurchase", schema);
