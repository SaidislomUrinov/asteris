const { Schema, model } = require("mongoose");
const { getNow, formatDate } = require("../utils/date.util");

const schema = new Schema({
  name: String,
  username: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
    trim: true,
  }, // hash.util.js fayli orqali generatsiya qilingan hash
  permissions: [String], //['dashboard', 'clients', 'leads','all' ...]
  access: String, //oxirgi jwt token saqlanadi maqsad: faqat bitta qurilmadan sessiya
  apiKey: {
    type: String,
    unique: true,
    sparse: true,
  }, // tashqi integratsiyalar (masalan lead qabul qilish) uchun shaxsiy kalit
  // Diqqat: default qiymat berilmaydi — sparse unique index faqat maydon
  // umuman mavjud bo'lmagan hujjatlarni e'tiborsiz qoldiradi, "null" qiymatli
  // bir nechta hujjatni emas (aks holda ikkinchi admin yaratishda duplicate
  // key xatosi chiqadi).
  role: {
    type: String,
    enum: ["admin", "owner"],
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

schema.virtual("lastUpdate").get(function () {
  return formatDate(this.updatedAt);
});

schema.virtual("date").get(function () {
  return formatDate(this.createdAt);
});

module.exports = model("Admin", schema);
