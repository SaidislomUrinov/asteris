const { Schema, model } = require("mongoose");
const Counter = require("./Counter");
const { formatDate, getNow } = require("../utils/date.util");

// Ota-ona xabarlari sozlamasi (API_CONTRACT_parent.md §2). Kalitlar
// `parentNotification.service.centerAllows(center, type)` o'qiydigan
// nomlar bilan bir xil. `quietHours` faqat REJALASHTIRILGAN (qarz) xabarlar
// uchun — davomat/to'lov voqea paytida ketadi.
const parentNotificationsSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    attendance: { enabled: { type: Boolean, default: true } },
    lessonFinished: {
      enabled: { type: Boolean, default: true },
      includeGrade: { type: Boolean, default: true },
    },
    payment: { enabled: { type: Boolean, default: true } },
    // Oylik yutuq nishonlari xabari (API_CONTRACT_badges_monthly_rank.md §C).
    badge: { enabled: { type: Boolean, default: true } },
    debt: {
      enabled: { type: Boolean, default: true },
      daysBefore: { type: Number, default: 3, min: 0, max: 14 },
      daysAfter: { type: [Number], default: () => [0, 3, 7, 14] },
    },
    showGrades: { type: Boolean, default: true },
    quietHours: {
      from: { type: String, default: "21:00" },
      to: { type: String, default: "08:00" },
    },
  },
  { _id: false },
);

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
  parentNotifications: {
    type: parentNotificationsSchema,
    default: () => ({}),
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
