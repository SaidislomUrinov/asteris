const { Schema, model } = require("mongoose");
const { formatDate, getNow } = require("../utils/date.util");

// Audit jurnali — "kim, qachon, nima qildi" (CLAUDE.md). Har mutatsiya
// servis ichidan aniq chaqiruv bilan yoziladi (middleware EMAS: middleware
// faqat HTTP darajasini ko'radi, "nima o'zgardi" esa faqat servisda ma'lum).
//
// Amalni bajaruvchi uch xil MUSTAQIL modeldan bo'lishi mumkin (Admin /
// Client / Staff), shuning uchun `refPath` emas, id + kind juftligi —
// Notification.recipient va Student.payments.collectedBy bilan bir xil naqsh.
const changeSchema = new Schema(
  {
    field: { type: String, required: true },
    from: { type: Schema.Types.Mixed, default: null },
    to: { type: Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const schema = new Schema({
  // null = platforma darajasidagi amal (Platform Admin), tenantga tegishli emas
  client: { type: Schema.Types.ObjectId, ref: "Client", default: null },
  center: { type: Schema.Types.ObjectId, ref: "Center", default: null },
  actor: {
    id: { type: Schema.Types.ObjectId, required: true },
    kind: { type: String, enum: ["admin", "client", "staff"], required: true },
    // Ism SNAPSHOT sifatida saqlanadi — hodim o'chirilsa ham jurnalda
    // "kim qilgani" o'qilishi kerak (populate keyinchalik bo'sh qaytardi).
    name: { type: String, default: "" },
    role: { type: String, default: "" },
  },
  // "student:create", "payment:refund", "staff:delete" ...
  action: { type: String, required: true },
  entity: {
    type: { type: String, required: true }, // "Student" | "Payment" | ...
    id: { type: Schema.Types.ObjectId, default: null },
    label: { type: String, default: "" }, // "Ali Valiyev" — o'qishga qulay
  },
  // Faqat O'ZGARGAN maydonlar (audit.util.diff natijasi)
  changes: { type: [changeSchema], default: [] },
  meta: { type: Object, default: {} }, // ip, userAgent, qo'shimcha kontekst
  createdAt: { type: Number, default: getNow },
});

schema.virtual("date").get(function () {
  return formatDate(this.createdAt);
});

// Tenant izolyatsiyasi + tez filtr (API_CONTRACT_performance.md §1 naqshi)
schema.index({ client: 1, createdAt: -1 });
schema.index({ client: 1, "entity.type": 1, "entity.id": 1, createdAt: -1 });
schema.index({ client: 1, "actor.id": 1, createdAt: -1 });
schema.index({ createdAt: -1 }); // Admin cross-tenant ro'yxati

// DIQQAT: TTL indeks (`expireAfterSeconds`) ATAYIN qo'yilmadi. MongoDB TTL
// faqat BSON `Date` maydonida ishlaydi, bu loyihada esa barcha sanalar
// Number (unix) — ya'ni TTL indeks jimgina hech narsa o'chirmasdi va
// "1 yildan keyin tozalanadi" degan yolg'on kafolat berardi. Tozalash
// kerak bo'lganda alohida job (`createdAt < getNow() - 1yil`) yoziladi.

module.exports = model("AuditLog", schema);
