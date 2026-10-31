const { Schema, model } = require("mongoose");
const { getNow } = require("../utils/date.util");

// Admin yaratadigan global SMS paket (docs/API_CONTRACT_sms_packages.md).
// Sotib olinganlar SmsPurchase'da snapshot sifatida qoladi — paket o'zgarsa/o'chsa ta'sir qilmaydi.
const schema = new Schema({
  name: { type: String, required: true, trim: true },
  smsCount: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 1000 }, // UZS; inPAY minimumi
  validityDays: { type: Number, default: 30, min: 0 }, // 0 = cheksiz
  active: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
  createdAt: { type: Number, default: getNow },
  updatedAt: { type: Number, default: getNow },
});

schema.index({ active: 1, order: 1 });

module.exports = model("SmsPackage", schema);
