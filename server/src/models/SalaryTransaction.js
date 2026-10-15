const { Schema, model } = require("mongoose");
const { formatDate, getNow } = require("../utils/date.util");

// payout — oy uchun qolgan oylikni BERISH (odatda oy yopilgach, keyingi oy
// boshida). withdrawal esa oy davomida oldindan olingan pul — ikkalasi ham
// berilgan pul, lekin ma'nosi boshqa.
const TYPES = ["advance", "withdrawal", "payout", "bonus", "penalty"];

// Ish haqi tranzaksiyalari — moliyaviy yozuv, HECH QACHON o'chirilmaydi
// (CLAUDE.md "Soft Delete va Moliyaviy yozuvlar"): bekor qilinsa faqat
// status "cancelled" ga o'tadi, hujjat qolaveradi. Oylikning o'zi alohida
// hujjatda SAQLANMAYDI — salary.service.js har safar realtime hisoblaydi,
// bu kolleksiyada faqat qo'lda kiritilgan harakatlar (avans, oldindan pul
// olish, bonus, jarima) yotadi.
const schema = new Schema({
  client: {
    type: Schema.Types.ObjectId,
    ref: "Client",
    required: true,
  },
  center: {
    type: Schema.Types.ObjectId,
    ref: "Center",
    required: true,
  },
  staff: {
    type: Schema.Types.ObjectId,
    ref: "Staff",
    required: true,
  },
  month: {
    type: String, // "YYYY-MM" — qaysi oy oyligidan ushlanadi/qo'shiladi
    required: true,
  },
  type: {
    type: String,
    enum: TYPES,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 1,
  },
  note: {
    type: String,
    default: "",
    trim: true,
  },
  status: {
    type: String,
    enum: ["active", "cancelled"],
    default: "active",
  },
  cancelledAt: {
    type: Number,
    default: null,
  },
  createdAt: {
    type: Number,
    default: getNow,
  },
});

schema.index({ client: 1, staff: 1, month: 1 });

schema.virtual("date").get(function () {
  return formatDate(this.createdAt);
});

schema.statics.TYPES = TYPES;

module.exports = model("SalaryTransaction", schema);
