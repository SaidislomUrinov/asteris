const { Schema, model } = require("mongoose");
const { formatDate, getNow } = require("../utils/date.util");

// O'quvchi telefon raqam asosida yagona hujjat (CLAUDE.md "Ma'lumotlar
// modeli") — `client` maydoni hujjat darajasida YO'Q, bir kishi ko'p
// Client/Center/Group'ga `groups[]` orqali bog'lanadi. Har bir `groups[]`
// elementi bitta guruhga yozilishni, shu guruh uchun kelishilgan narxni va
// bo'lib-bo'lib to'lovlar tarixini (`payments[]`) alohida saqlaydi — CLAUDE.md
// "To'lov (Payment)": moliyaviy yozuvlar hech qachon o'chirilmaydi, faqat
// status o'zgaradi (cancelled/refunded), refund yangi yozuv sifatida qo'shiladi.
const paymentSchema = new Schema(
  {
    amount: { type: Number, required: true, min: 1 },
    type: { type: String, enum: ["cash", "card", "mixed", "previousMonth"], default: "cash" },
    status: { type: String, enum: ["paid", "cancelled", "refunded"], default: "paid" },
    note: { type: String, default: "", trim: true },
    forMonth: { type: String, default: "", trim: true }, // "YYYY-MM" — chek uchun "qaysi oy uchun"
    // To'lovni KIM qabul qilgani ("Tushumlar" sahifasi shu maydonga tayanadi).
    // `refPath` emas, aniq `kind` — chunki qabul qiluvchi ikki xil, mustaqil
    // modeldan bo'lishi mumkin: Client Owner (`Client`) yoki hodim (`Staff`).
    // ESKI to'lovlarda bu maydon YO'Q (null) — moliyaviy yozuvlar qayta
    // yozilmaydi (CLAUDE.md), shuning uchun UI'da "noma'lum" deb ko'rsatiladi.
    collectedBy: { type: Schema.Types.ObjectId, default: null },
    collectedByKind: { type: String, enum: ["owner", "staff", null], default: null },
    date: { type: Number, default: getNow },
  },
  { _id: true },
);

// To'lov krediti — "shu bitta dars kuni uchun bu o'quvchidan pul olinmaydi"
// belgisi (faqat sana, summasi YO'Q — computeBilling summani JORIY narx va
// JORIY dars-kunlari soniga qarab har safar jonli hisoblaydi, shunda
// qarzdorlik va "to'lash kerak bo'lgan summa" doim bir-biriga mos keladi).
// Ikki manbadan keladi: (1) davomat orqali "sababli"/"sababsiz kelmagan kun
// uchun to'lov o'tkaziladi" sozlamasi yoqilgan bo'lsa (attendance.service.js
// "applyCredit"), yoki (2) yangi o'quvchi sikl o'rtasida qo'shilganda, shu
// sikldan hozirgacha allaqachon o'tgan har bir dars kuni uchun (student.
// service.js "create" proration — har o'tkazib yuborilgan kun uchun bitta
// yozuv).
const creditSchema = new Schema(
  {
    date: { type: String, required: true }, // "YYYY-MM-DD"
  },
  { _id: false },
);

// Narx o'zgarish tarixi — o'quvchining kelishilgan narxi (`price`) keyinroq
// tahrirlansa, computeBilling O'TGAN sikllarni YANGI narx bilan qayta
// hisoblab yubormasligi kerak (aks holda qarzdorlik kutilmaganda sakraydi).
// Har bir yozuv "shu sanadan boshlab shu narx amal qildi" degani —
// resolveCycle har bir sikl uchun o'sha siklga mos narxni shu tarixdan
// tanlab oladi.
const priceHistorySchema = new Schema(
  {
    price: { type: Number, required: true, min: 0 },
    from: { type: Number, required: true },
  },
  { _id: false },
);

const groupEntrySchema = new Schema(
  {
    group: { type: Schema.Types.ObjectId, ref: "Group", required: true },
    center: { type: Schema.Types.ObjectId, ref: "Center", required: true },
    client: { type: Schema.Types.ObjectId, ref: "Client", required: true },
    subject: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    price: { type: Number, default: 0, min: 0 }, // shu guruh uchun kelishilgan JORIY narx
    priceHistory: { type: [priceHistorySchema], default: [] },
    status: { type: String, enum: ["active", "left"], default: "active" },
    joinedAt: { type: Number, default: getNow },
    leftAt: { type: Number, default: null },
    payments: { type: [paymentSchema], default: [] },
    credits: { type: [creditSchema], default: [] },
  },
  { _id: true },
);

const schema = new Schema({
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  fullName: {
    type: String,
    required: true,
    trim: true,
  },
  photo: {
    type: String,
    default: "",
  },
  parentPhone: {
    type: String,
    default: "",
    trim: true,
  },
  // QR davomat uchun doimiy maxfiy token (`attendance.qr` tarif flagi ostida).
  // O'quvchi hujjatiga bir marta beriladi va o'zgarmaydi — chop etilgan karta
  // yoki telefondagi rasm uzoq muddat ishlashi kerak. Tanlangan bo'lsa, qo'lda
  // reset qilinadi (yangi token eskisini bekor qiladi). `sparse` — eski
  // hujjatlarda token yo'q (null), unique index ularni to'qnashtirmasligi uchun.
  // `sparse` EMAS, `partialFilterExpression` — sparse faqat maydon
  // UMUMAN YO'Q hujjatlarni chetlab o'tadi, `default: null` esa maydonni
  // aniq `null` qiymat bilan yozadi, natijada ikkinchi o'quvchi
  // yaratilganda "duplicate key: qrToken: null" xatosi chiqardi.
  // Partial index faqat STRING qiymatlarni indekslaydi, tokensiz
  // o'quvchilar qancha bo'lsa ham to'qnashmaydi (Client.phone bilan
  // bir xil naqsh).
  qrToken: {
    type: String,
    default: null,
    index: {
      unique: true,
      partialFilterExpression: { qrToken: { $type: "string" } },
    },
  },
  groups: {
    type: [groupEntrySchema],
    default: [],
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  deletedAt: {
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

schema.virtual("lastUpdate").get(function () {
  return formatDate(this.updatedAt);
});

// Tenant izolyatsiyasi indekslari. Shared Database'da INDEKSSIZ har so'rov
// COLLSCAN bo'ladi — ya'ni bir markazning so'rovi qolgan BARCHA markazlarning
// hujjatlarini ham skanerlaydi va sekinlashuv butun platforma hajmiga
// bog'lanadi (API_CONTRACT_performance.md §1).
schema.index({ "groups.client": 1, "groups.center": 1 });
schema.index({ "groups.group": 1, "groups.status": 1 });
schema.index({ isDeleted: 1 });

module.exports = model("Student", schema);
