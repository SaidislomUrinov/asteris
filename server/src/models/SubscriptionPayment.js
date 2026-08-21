const { Schema, model } = require("mongoose");
const { getNow, formatDate } = require("../utils/date.util");

const STATUSES = ["pending", "paid", "cancelled", "failed"];

// inPAY orqali obuna to'lovlari uchun tranzaksiya yozuvi — moliyaviy yozuv,
// hech qachon o'chirilmaydi, faqat status o'zgaradi.
const schema = new Schema({
  client: {
    type: Schema.Types.ObjectId,
    ref: "Client",
    required: true,
  },
  tariff: {
    type: Schema.Types.ObjectId,
    ref: "Tariff",
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  months: {
    type: Number,
    required: true,
  }, // tanlangan obuna muddati (1/3/6/9/12) — tasdiqlangach endDate shundan hisoblanadi
  orderId: {
    type: String,
    required: true,
    unique: true,
  }, // inPAY order_id
  payUrl: {
    type: String,
    default: "",
  },
  status: {
    type: String,
    enum: STATUSES,
    default: "pending",
  },
  subscription: {
    type: Schema.Types.ObjectId,
    ref: "Subscription",
    default: null,
  }, // to'lov tasdiqlangach yaratilgan obunaga bog'lanadi
  paidAt: {
    type: Number,
    default: null,
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

schema.virtual("date").get(function () {
  return formatDate(this.createdAt);
});

schema.statics.STATUSES = STATUSES;

module.exports = model("SubscriptionPayment", schema);
