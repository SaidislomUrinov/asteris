const { Schema, model } = require("mongoose");
const { formatDate, getNow } = require("../utils/date.util");

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

// O'quvchilar bu yerda SAQLANMAYDI — Student.groups[] orqali bog'lanadi
// (API_CONTRACT.md "Guruh (Group) — qayta qurish").
const schema = new Schema({
  // "individual" — yashirin, BITTA o'quvchili guruh (API_CONTRACT_individual_students.md).
  // Eski hujjatlarda maydon yo'q → "group" deb talqin qilinadi: querylarda
  // `kind: { $ne: "individual" }` ishlatilsin, `kind: "group"` EMAS.
  kind: {
    type: String,
    enum: ["group", "individual"],
    default: "group",
  },
  // O'qituvchiga to'lovning necha foizi beriladi (0–100) — FAQAT individual
  // guruhda; oylikka fiks/guruh foizidan MUSTAQIL ravishda qo'shiladi.
  teacherPercent: {
    type: Number,
    default: null,
    min: 0,
    max: 100,
  },
  // Individual o'quvchiga WECOIN beriladimi (API_CONTRACT_individual_coins.md) —
  // har kuni keladigan individual o'quvchida tangalar juda tez to'planadi.
  // Yo'q/false → shu guruh yozuvlari tanga bermaydi. Oddiy guruhga ta'sir qilmaydi.
  coinsEnabled: {
    type: Boolean,
    default: false,
  },
  client: {
    type: Schema.Types.ObjectId,
    ref: "Client",
    required: true,
  },
  // IXTIYORIY qo'lda qo'yilgan nom — bo'lmasa (null) frontend/DTO avvalgidek
  // fan nomi + pendingId/activeId'dan hisoblaydi (API_CONTRACT_group_rename.md).
  name: {
    type: String,
    default: null,
    trim: true,
  },
  // IXTIYORIY Telegram guruh manzili — har doim `https://t.me/<path>`
  // ko'rinishida normallashtirilgan holda saqlanadi (group.service.js#setTelegramLink).
  telegramLink: {
    type: String,
    default: null,
  },
  center: {
    type: Schema.Types.ObjectId,
    ref: "Center",
    required: true,
  },
  subject: {
    type: Schema.Types.ObjectId,
    ref: "Subject",
    required: true,
  },
  teacher: {
    type: Schema.Types.ObjectId,
    ref: "Staff",
    default: null,
  },
  // Yordamchi o'qituvchi — IXTIYORIY. Darsda o'qituvchiga yordam beradi:
  // davomat belgilaydi, baho qo'yadi, dars rejasini "bajarildi" deb
  // belgilaydi. Moliyaviy ma'lumot unga ham ko'rinmaydi.
  assistant: {
    type: Schema.Types.ObjectId,
    ref: "Staff",
    default: null,
  },
  room: {
    type: Schema.Types.ObjectId,
    ref: "Room",
    default: null,
  },
  days: {
    type: [String],
    enum: DAYS,
    default: [],
  },
  startTime: {
    type: String, // "HH:mm"
    default: "",
  },
  endTime: {
    type: String, // "HH:mm"
    default: "",
  },
  maxStudents: {
    type: Number,
    default: null,
  },
  status: {
    type: String,
    enum: ["pending", "active", "finished"],
    default: "pending",
  },
  // Har biri Client darajasida mustaqil ketma-ketlik (Counter
  // "group_pending_{clientId}" / "group_active_{clientId}"). pendingId
  // yaratilganda darhol beriladi. activeId faqat activate qilinganda
  // beriladi va finished bo'lgandan keyin ham o'zgarmaydi.
  pendingId: {
    type: Number,
    required: true,
  },
  activeId: {
    type: Number,
    default: null,
  },
  // Darslar aynan qachon boshlangani (activate() chaqirilgan payt) — to'lov
  // oylik siklini shu sanaga (kun-oyga) langar qilib hisoblash uchun kerak
  // (masalan 14-sanadan boshlansa, har oylik sikl 14-sanadan 14-sanagacha).
  activatedAt: {
    type: Number,
    default: null,
  },
  // Kurs dasturining nechanchi darsidan boshlangani — dastur o'rtasidan
  // qo'shilgan guruh uchun. Guruhga BITTA son (har darsga alohida "done"
  // checkbox emas): progress Attendance unikal sanalari + shu offset.
  lessonOffset: {
    type: Number,
    default: 0,
  },
  finishedAt: {
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
});

schema.virtual("date").get(function () {
  return formatDate(this.createdAt);
});

schema.virtual("activatedDate").get(function () {
  return this.activatedAt ? formatDate(this.activatedAt) : null;
});

schema.virtual("lastUpdate").get(function () {
  return formatDate(this.updatedAt);
});

schema.statics.DAYS = DAYS;

// Tenant izolyatsiyasi indekslari — API_CONTRACT_performance.md §1
schema.index({ client: 1, center: 1, isDeleted: 1, status: 1 });
schema.index({ client: 1, room: 1, isDeleted: 1, status: 1 });
schema.index({ client: 1, teacher: 1, isDeleted: 1 });
schema.index({ client: 1, assistant: 1, isDeleted: 1 });
schema.index({ client: 1, kind: 1, isDeleted: 1, status: 1 });

module.exports = model("Group", schema);
