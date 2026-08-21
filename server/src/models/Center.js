const { Schema, model } = require("mongoose");
const Counter = require("./Counter");
const { formatDate, getNow } = require("../utils/date.util");

const schema = new Schema({
  centerId: {
    type: Number,
    unique: true,
  },
  client: {
    type: Schema.Types.ObjectId,
    ref: "Client",
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  logo: {
    type: String,
    default: "",
  },
  slogan: {
    type: String,
    default: "",
    trim: true,
  },
  // Tarif pasaytirilganda ortiqcha markaz o'chirilmaydi, shu status bilan
  // bloklanadi — tarif ko'tarilsa qayta "active" qilinadi.
  status: {
    type: String,
    enum: ["active", "blocked"],
    default: "active",
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
  if (this.isNew && this.centerId == null) {
    this.centerId = await Counter.next("center");
  }
});

schema.virtual("date").get(function () {
  return formatDate(this.createdAt);
});

schema.virtual("lastUpdate").get(function () {
  return formatDate(this.updatedAt);
});

// Tenant izolyatsiyasi indeksi — API_CONTRACT_performance.md §1
schema.index({ client: 1, isDeleted: 1 });

module.exports = model("Center", schema);
