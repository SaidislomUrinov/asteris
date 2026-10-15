const { Schema, model } = require("mongoose");
const { getNow } = require("../utils/date.util");

// O'quvchining FILIALDAGI tanga balansi (API_CONTRACT_wecoin.md §1.3).
// Haqiqat manbai — CoinTransaction daftari; bu hujjat esa atomar sotib olish
// (`balance: { $gte: price }` sharti) uchun tezkor hisob.
const schema = new Schema({
  client: { type: Schema.Types.ObjectId, ref: "Client", required: true },
  center: { type: Schema.Types.ObjectId, ref: "Center", required: true },
  student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
  balance: { type: Number, default: 0, min: 0 },
  earned: { type: Number, default: 0 },
  spent: { type: Number, default: 0 },
  createdAt: { type: Number, default: getNow },
  updatedAt: { type: Number, default: getNow },
});

schema.index({ student: 1, center: 1 }, { unique: true });
schema.index({ client: 1, center: 1, balance: -1 });

module.exports = model("CoinWallet", schema);
