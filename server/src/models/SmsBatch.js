const { Schema, model } = require("mongoose");
const { getNow } = require("../utils/date.util");

// Bitta "Yuborish" bosilishi = bitta partiya. Moliyaviy/audit xarakterida —
// o'chirilmaydi.
const schema = new Schema({
  client: { type: Schema.Types.ObjectId, ref: "Client", required: true },
  center: { type: Schema.Types.ObjectId, ref: "Center", required: true },
  template: { type: Schema.Types.ObjectId, ref: "SmsTemplate", default: null },
  // Shablon keyin o'zgarsa/o'chsa ham tarixda mavzu va sarlavha qolishi uchun nusxa.
  templateTitle: { type: String, default: "" },
  topic: { type: String, default: "info" },
  audience: { type: String, enum: ["parents", "students"], required: true },
  filters: {
    groupIds: { type: [Schema.Types.ObjectId], default: [] },
    debtOnly: { type: Boolean, default: false },
    month: { type: String, default: "" },
    date: { type: String, default: "" }, // "Darsga kelmadi" mavzusida: qaysi kun
  },
  createdBy: {
    id: { type: Schema.Types.ObjectId, default: null },
    kind: { type: String, default: "" },
    name: { type: String, default: "" },
  },
  total: { type: Number, default: 0 },
  sent: { type: Number, default: 0 }, // shlyuz qabul qildi
  delivered: { type: Number, default: 0 },
  failed: { type: Number, default: 0 },
  skipped: { type: Number, default: 0 }, // raqami yo'q/yaroqsiz
  segments: { type: Number, default: 0 }, // balansdan yechilgan jami qism
  refundedSegments: { type: Number, default: 0 }, // shlyuz qabul qilmaganlari qaytarildi
  // Qaysi paketdan nechta yechildi (refund shu bo'yicha qaytadi).
  allocations: {
    type: [
      {
        _id: false,
        purchase: { type: Schema.Types.ObjectId, ref: "SmsPurchase" },
        count: { type: Number, default: 0 },
        refunded: { type: Number, default: 0 },
      },
    ],
    default: [],
  },
  status: { type: String, enum: ["sending", "done", "failed"], default: "sending" },
  startedAt: { type: Number, default: getNow },
  finishedAt: { type: Number, default: null },
  createdAt: { type: Number, default: getNow },
});

schema.index({ client: 1, center: 1, createdAt: -1 });

module.exports = model("SmsBatch", schema);
