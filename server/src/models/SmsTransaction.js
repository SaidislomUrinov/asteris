const { Schema, model } = require("mongoose");
const { getNow } = require("../utils/date.util");

// SMS balans tarixi — moliyaviy yozuv, o'chirilmaydi. `amount` doim musbat (segment),
// yo'nalishni `type` belgilaydi.
const schema = new Schema({
  client: { type: Schema.Types.ObjectId, ref: "Client", required: true },
  center: { type: Schema.Types.ObjectId, ref: "Center", default: null },
  type: { type: String, enum: ["topup", "spend", "refund", "expire"], required: true },
  amount: { type: Number, required: true, min: 1 },
  purchase: { type: Schema.Types.ObjectId, ref: "SmsPurchase", default: null },
  batch: { type: Schema.Types.ObjectId, ref: "SmsBatch", default: null },
  packageName: { type: String, default: "" },
  note: { type: String, default: "" },
  createdAt: { type: Number, default: getNow },
});

schema.index({ client: 1, createdAt: -1 });
schema.index({ client: 1, type: 1, createdAt: -1 });
schema.index({ type: 1 });

module.exports = model("SmsTransaction", schema);
