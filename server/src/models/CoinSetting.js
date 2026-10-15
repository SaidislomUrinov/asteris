const { Schema, model } = require("mongoose");
const { getNow } = require("../utils/date.util");

// WECOIN QOIDALARI (API_CONTRACT_wecoin.md §1.2) — har FILIAL uchun bitta
// hujjat. Owner/Reception sozlaydi: qaysi natija uchun oy yakunida necha
// tanga beriladi. Tarqatish `coin.service.distributeMonth` da.
const COIN_MAX = 1000;

const coin = { type: Number, default: 0, min: 0, max: COIN_MAX };

const actorSchema = new Schema(
  {
    id: { type: Schema.Types.ObjectId, default: null },
    kind: { type: String, enum: ["client", "staff"], default: null },
  },
  { _id: false },
);

const rulesSchema = new Schema(
  {
    // HAR bir shunday baho uchun (masalan 10 → 2 tanga, 5 → 1 tanga).
    grades: {
      type: [
        new Schema(
          { value: { type: Number, min: 1, max: 10, required: true }, coins: coin },
          { _id: false },
        ),
      ],
      default: [],
    },
    // HAR vazifa natijasi uchun (Homework.results).
    homework: { type: new Schema({ done: coin, partial: coin }, { _id: false }), default: () => ({}) },
    // HAR kelgan dars uchun (kechikkan ham "present").
    attendance: { type: new Schema({ present: coin }, { _id: false }), default: () => ({}) },
    // Oylik reyting medali (StudentMedal position 1/2/3).
    medals: { type: new Schema({ gold: coin, silver: coin, bronze: coin }, { _id: false }), default: () => ({}) },
  },
  { _id: false },
);

const schema = new Schema({
  client: { type: Schema.Types.ObjectId, ref: "Client", required: true },
  center: { type: Schema.Types.ObjectId, ref: "Center", required: true, unique: true },
  enabled: { type: Boolean, default: false },
  rules: { type: rulesSchema, default: () => ({}) },
  updatedBy: { type: actorSchema, default: () => ({}) },
  createdAt: { type: Number, default: getNow },
  updatedAt: { type: Number, default: getNow },
});

schema.pre("save", function () {
  this.updatedAt = getNow();
});

module.exports = model("CoinSetting", schema);
module.exports.COIN_MAX = COIN_MAX;
