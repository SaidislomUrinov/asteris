const { Schema, model } = require("mongoose");
const { getNow, formatDate } = require("../utils/date.util");

const STATUSES = ["active", "changed", "cancelled", "expired"];
const SOURCES = ["admin", "trial", "payment"];

// Moliyaviy yozuv — hech qachon o'chirilmaydi, faqat status o'zgaradi.
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
  // Tarif holatining nusxasi. JORIY obunada Tariff tahrirlanganda nom/limit/
  // ruxsatlar qayta yoziladi (clientService.syncSubscriptionsWithTariff);
  // `price` va tarixiy ("changed"/"cancelled") obunalar esa muzlatilgan
  // holicha qoladi. Tariff o'chirilsa ham oxirgi holat shu yerda saqlanadi.
  tariffSnapshot: {
    name: String,
    price: Number,
    studentLimit: Number,
    centerLimit: Number,
    teacherLimit: Number,
    receptionLimit: Number,
    allowedPermissions: [String],
  },
  // Haqiqiy kelishilgan obuna narxi — tariffSnapshot.price'dan farq qilishi
  // mumkin (masalan tanish-bilishlik chegirmasi). Moliyaviy hisob shundan olinadi.
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  startDate: {
    type: Number,
    required: true,
  },
  endDate: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: STATUSES,
    default: "active",
  },
  // Admin panel orqali qo'lda yaratilganda to'ldiriladi — trial/to'lov orqali
  // o'z-o'zidan yaratilgan obunalarda Admin ishtirok etmagani uchun bo'sh qoladi.
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: "Admin",
    default: null,
  },
  // Obuna qanday yaratilgani — Audit maqsadida.
  source: {
    type: String,
    enum: SOURCES,
    default: "admin",
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

schema.virtual("startDateText").get(function () {
  return formatDate(this.startDate);
});

schema.virtual("endDateText").get(function () {
  return formatDate(this.endDate);
});

schema.statics.STATUSES = STATUSES;

module.exports = model("Subscription", schema);
