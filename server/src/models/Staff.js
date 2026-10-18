const { Schema, model } = require("mongoose");
const Counter = require("./Counter");
const { getNow, formatDate } = require("../utils/date.util");

// "manager" roli olib tashlandi — uning o'rniga to'liq huquq `permissions:
// ["all"]` orqali beriladi (rol emas, ruxsat). "assistant" — YORDAMCHI
// O'QITUVCHI: guruhga biriktiriladi (ixtiyoriy) va darsda o'qituvchiga
// yordam beradi (davomat, baho, dars rejasini belgilash).
const ROLES = ["reception", "teacher", "assistant"];

const schema = new Schema({
  staffId: {
    type: Number,
    unique: true,
  },
  client: {
    type: Schema.Types.ObjectId,
    ref: "Client",
    required: true,
  },
  // ASOSIY filial — har doim `centers` ichida (API_CONTRACT_multi_center.md §1).
  // So'rov paytidagi FAOL filial `req.staff.center` ga middleware qo'yadi.
  center: {
    type: Schema.Types.ObjectId,
    ref: "Center",
    required: true,
  },
  // Hodim ishlaydigan barcha filiallar (kamida bitta). Rol va ruxsatlar
  // barcha filiallarda bir xil.
  centers: [
    {
      type: Schema.Types.ObjectId,
      ref: "Center",
    },
  ],
  name: {
    type: String,
    required: true,
    trim: true,
  },
  // Kirish identifikatori — `+998XXXXXXXXX` (API_CONTRACT_staff_phone.md §1).
  // Eski hodimlarda yo'q: maydon umuman yozilmaydi (`""` emas — aks holda
  // `{client, phone}` unique indeksida to'qnashadi).
  phone: {
    type: String,
    trim: true,
  },
  // ESKI identifikator — faqat raqami hali kiritilmagan hodimlar uchun zaxira
  // kirish yo'li. Yangi hodimlarda yozilmaydi.
  login: {
    type: String,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    trim: true,
  }, // hash.util.js orqali generatsiya qilingan hash
  role: {
    type: String,
    enum: ROLES,
    default: "reception",
  },
  permissions: [String], // Client Owner tarif ruxsat bergan doirada beradi
  // Faqat teacher/assistant uchun ma'noli — o'qituvchi qaysi fan(lar)ni
  // o'qitishi. Guruh yaratishda teacher/assistant ro'yxati shu bo'yicha
  // filtrlanadi (Group.subject bilan mos kelishi kerak).
  subjects: [
    {
      type: Schema.Types.ObjectId,
      ref: "Subject",
    },
  ],
  // Oylik hisoblash qiymati — "staff.salary.percentage" bo'lsa foiz (0-100),
  // "staff.salary.fixed" bo'lsa summa (so'm).
  // ESKI (bitta filial davri) — migratsiyadan keyin faqat fallback.
  salaryValue: {
    type: Number,
    default: null,
  },
  // Oylik QIYMATI filial kesimida — N va X filial oyliklari aralashmaydi.
  // Turi (fixed/percentage) esa hodim darajasida (`permissions`).
  salaryValues: [
    {
      _id: false,
      center: { type: Schema.Types.ObjectId, ref: "Center", required: true },
      value: { type: Number, default: null },
    },
  ],
  // Shaxsiy Telegram bog'lanishi — Client'dagi bilan bir xil naqsh
  // (API_CONTRACT.md "Telegram bog'lash").
  telegram: {
    chatId: { type: String, default: null },
    lang: { type: String, enum: ["uz", "ru", "en"], default: "uz" },
    linkedAt: { type: Number, default: null },
  },
  access: String, // oxirgi jwt token — bitta qurilmadan sessiya
  blocked: {
    type: Boolean,
    default: false,
  },
  introSeen: {
    type: Boolean,
    default: false,
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

// Raqam va login MIJOZ ichida yagona (brend subdomeni — API_CONTRACT_multi_center.md §1),
// faqat aktiv hujjatlar orasida: arxivlangan hodimning raqami qayta berilishi mumkin.
// `$type: "string"` — maydoni yo'q hujjatlar indeksga tushmaydi (login'siz yangi
// hodimlar `null` dublikati bo'lib qolmasin). Eski `{client, login}` indeksi
// (filtrsiz) scripts/migrate-staff-phone.js da almashtiriladi.
schema.index(
  { client: 1, phone: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false, phone: { $type: "string" } } },
);
schema.index(
  { client: 1, login: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false, login: { $type: "string" } } },
);

schema.pre("save", async function () {
  this.updatedAt = getNow();
  // Invariant: asosiy filial har doim `centers` ichida.
  if (this.center && !(this.centers || []).some((c) => String(c) === String(this.center))) {
    this.centers = [this.center, ...(this.centers || [])];
  }
  if (this.isNew && this.staffId == null) {
    this.staffId = await Counter.next("staff");
  }
});

schema.virtual("date").get(function () {
  return formatDate(this.createdAt);
});

schema.virtual("lastUpdate").get(function () {
  return formatDate(this.updatedAt);
});

schema.statics.ROLES = ROLES;

// Hodimning filiallari (migratsiyadan oldingi hujjatda `centers` bo'sh — asosiy filial).
const centersOf = (staff) => {
  const list = (staff?.centers || []).map(String).filter(Boolean);
  if (!list.length && staff?.center) list.push(String(staff.center));
  return [...new Set(list)];
};

// Shu filialdagi oylik qiymati; yozuv bo'lmasa asosiy filial uchun eski `salaryValue`.
const salaryValueOf = (staff, centerId) => {
  const key = String(centerId || staff?.center || "");
  const row = (staff?.salaryValues || []).find((r) => String(r.center) === key);
  if (row) return row.value ?? null;
  if (!(staff?.salaryValues || []).length && key === String(staff?.center || "")) return staff?.salaryValue ?? null;
  return null;
};

schema.statics.centersOf = centersOf;
schema.statics.salaryValueOf = salaryValueOf;

// Tenant izolyatsiyasi indeksi — API_CONTRACT_performance.md §1
schema.index({ client: 1, center: 1, isDeleted: 1, role: 1 });
schema.index({ client: 1, centers: 1, isDeleted: 1, role: 1 });

module.exports = model("Staff", schema);
