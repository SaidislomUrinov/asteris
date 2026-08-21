const { Schema, model } = require("mongoose");
const { formatDate, getNow } = require("../utils/date.util");

const CATEGORIES = ["rent", "utilities", "equipment", "marketing", "repair", "other"];

// Xarajat — moliyaviy yozuv, HECH QACHON o'chirilmaydi (CLAUDE.md "Soft
// Delete va Moliyaviy yozuvlar"): xato kiritilgan bo'lsa status "cancelled"
// ga o'tadi, hujjat qolaveradi.
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
  title: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: String,
    enum: CATEGORIES,
    default: "other",
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
  month: {
    type: String, // "YYYY-MM" — hisobot oyi (kiritish sanasidan avtomatik)
    required: true,
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
  updatedAt: {
    type: Number,
    default: getNow,
  },
});

schema.index({ client: 1, center: 1, month: 1 });

schema.pre("save", async function () {
  this.updatedAt = getNow();
});

schema.virtual("date").get(function () {
  return formatDate(this.createdAt);
});

schema.statics.CATEGORIES = CATEGORIES;

module.exports = model("Expense", schema);
