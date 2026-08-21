const { Schema, model } = require("mongoose");
const { formatDate, getNow } = require("../utils/date.util");

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
  name: {
    type: String,
    required: true,
    trim: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  durationMonths: {
    type: Number,
    required: true,
    min: 1,
  },
  createdAt: {
    type: Number,
    default: getNow,
  },
  updatedAt: {
    type: Number,
    default: getNow,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  deletedAt: {
    type: Number,
    default: null,
  },
});
schema.pre("save", async function () {
  this.updatedAt = getNow();
});

schema.virtual("date").get(function () {
  return formatDate(this.createdAt);
});

schema.virtual("lastUpdate").get(function () {
  return formatDate(this.updatedAt);
});

// Tenant izolyatsiyasi indeksi — API_CONTRACT_performance.md §1
schema.index({ client: 1, center: 1, isDeleted: 1 });

module.exports = model("Subject", schema);
