const { Schema, model } = require("mongoose");
const { getNow, formatDate } = require("../utils/date.util");

const schema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  }, // oylik narx, UZS
  trialDays: {
    type: Number,
    default: 0,
    min: 0,
  }, // test uchun necha kun bepul foydalanish mumkin
  // Limit maydonlari: -1 = cheksiz, 0 va undan yuqori = aniq son
  studentLimit: {
    type: Number,
    required: true,
    min: -1,
  },
  centerLimit: {
    type: Number,
    required: true,
    min: -1,
  },
  teacherLimit: {
    type: Number,
    required: true,
    min: -1,
  },
  receptionLimit: {
    type: Number,
    required: true,
    min: -1,
  },
  allowedPermissions: {
    type: [String],
    enum: [
      "excel.export", // Ma'lumotlarni Excel (.xlsx) formatiga eksport qilish

      "telegram.notifications", // Telegram bot orqali avtomatik xabarnomalar yuborish

      "teacher.notifications", // O'qituvchilarga bildirishnomalar
      "teacher.performance", // O'qituvchi ish unumdorligi
      // Ish haqi — Menejer/Resepshin/O'qituvchi barchasiga tegishli (masalan
      // o'quvchi to'lovidan foiz: o'qituvchiga, resepshinga, menejerga alohida
      // ulush, qolgani markaz foydasi).
      "staff.salary.advance", // Hodimga avans berish
      "staff.salary.percentage", // Hodim maoshini foiz asosida hisoblash
      "staff.salary.fixed", // Hodim uchun qat'iy oylik
      "staff.bonus", // Bonus va rag'batlantirish

      "student.rate", // O'quvchini baholash
      "student.transfer", // O'quvchini guruhlar orasida ko'chirish

      "attendance.qr", // QR kod orqali davomat olish
      "attendance.report", // Davomat hisobotlari

      "room.control", // Xonalar va auditoriyalarni boshqarish

      "lesson.planning", // Dars rejalashtirish
      "homework.manage", // Uy vazifalarini boshqarish

      "certificate.manage", // Sertifikat yaratish va berish

      "receipt.manage", // To'lov cheklarini yaratish va chop etish

      "finance.expense", // Xarajatlar
      "finance.refund", // To'lovni qaytarish
      "finance.report", // Moliyaviy hisobotlar

      "gamification.badges", // O'quvchi yutuq nishonlari (oylik badge'lar)

      "ai.report", // AI hisobotlari
      "ai.advice", // AI tavsiyalari va maslahatlari
    ],
  },
  // Saytdagi narx sahifasida ko'rsatiladimi. Default `false` — tarif admin
  // panelda tayyorlanadi, faqat ataylab yoqilgach ommaga chiqadi.
  isPublic: {
    type: Boolean,
    default: false,
  },
  // Narx sahifasida "eng ommabop" deb ajratib ko'rsatiladigan tarif.
  highlighted: {
    type: Boolean,
    default: false,
  },
  // Narx sahifasidagi bir qatorli izoh — "Bitta filialli markazlar uchun".
  tagline: {
    type: String,
    trim: true,
    default: "",
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

module.exports = model("Tariff", schema);
