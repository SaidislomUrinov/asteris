const { Schema, model } = require("mongoose");
const { getNow } = require("../utils/date.util");

// Har FILIAL (Center) uchun bitta hujjat — "sababli"/"sababsiz kelmagan kun
// uchun to'lov keyingi oyga o'tkazilsinmi" sozlamasi. Client darajasida emas
// Center darajasida, chunki har filial o'z qoidasini tanlashi kerak (bir
// xil Client'ning turli filiallari turlicha ishlashi mumkin). Teacher maosh
// maydonlari REZERV — Salary moduli hali qurilmagan, hozircha faqat
// saqlanadi, real hisobga ulanish keyingi bosqichda amalga oshiriladi.
const schema = new Schema({
  client: {
    type: Schema.Types.ObjectId,
    ref: "Client",
    required: true,
  },
  center: {
    type: Schema.Types.ObjectId,
    ref: "Center",
    required: true,
    unique: true,
  },
  excusedRollsOverStudentFee: {
    type: Boolean,
    default: true,
  },
  unexcusedRollsOverStudentFee: {
    type: Boolean,
    default: false,
  },
  // true = yuqoridagi "keyingi oyga o'tkazish" HAR KELMAGAN KUN uchun emas,
  // faqat o'quvchi KETMA-KET 3 ta darsga kelmaganda ishlaydi: 3 kunlik summa
  // shu oy o'qituvchi percent oyligi va markaz tushumidan keyingi oyga
  // o'tkaziladi, o'quvchining keyingi to'lovida chegirma bo'ladi
  // (utils/rollover.util.js). false = eski xatti-harakat (har kun darhol kredit).
  rolloverOnConsecutiveAbsence: {
    type: Boolean,
    default: false,
  },
  // true = shu kun uchun pul o'qituvchi oyligidan USHLAB QOLINADI (kesiladi).
  // false = ushlab qolinmaydi (keyingi oyga o'tkaziladi, o'qituvchi
  // jarimalanmaydi). Sababli kelmaganda ushlash odatda YO'Q (default false),
  // sababsiz kelmaganda odatda BOR (default true).
  excusedTeacherSalaryWithheld: {
    type: Boolean,
    default: false,
  },
  unexcusedTeacherSalaryWithheld: {
    type: Boolean,
    default: true,
  },
  // QR skan dars boshlanishidan shuncha daqiqa o'tib kelsa, yozuv `late`
  // deb belgilanadi (status baribir "present"). 0 = kechikish belgilanmaydi.
  // Faqat QR oqimiga ta'sir qiladi — qo'lda belgilashda vaqt ma'lum emas.
  lateAfterMinutes: {
    type: Number,
    default: 10,
    min: 0,
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

module.exports = model("AttendanceSetting", schema);
