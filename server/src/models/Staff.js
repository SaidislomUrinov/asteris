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
  login: {
    type: String,
    required: true,
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
  // "staff.salary.fixed" bo'lsa summa (so'm). "staff.salary.perGroup" uchun
  // bu yerda saqlanmaydi (stavka har bir guruhga alohida, Guruh moduli
  // qurilganda belgilanadi).
  salaryValue: {
    type: Number,
    default: null,
  },
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

// Faqat aktiv (isDeleted:false) hujjatlar orasida unique — soft-delete qilingan
// hodimning raqami keyinchalik qayta ishlatilishi mumkin bo'lishi kerak.
schema.index({ login: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });

schema.pre("save", async function () {
  this.updatedAt = getNow();
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

// Tenant izolyatsiyasi indeksi — API_CONTRACT_performance.md §1
schema.index({ client: 1, center: 1, isDeleted: 1, role: 1 });

module.exports = model("Staff", schema);
