const { Schema, model } = require("mongoose");
const { getNow } = require("../utils/date.util");

// Guruh kalendarida bitta dars kunini "dam olish kuni" deb belgilash —
// markaz (Client) xodimi LessonCalendar'da o'sha sanaga bosib belgilaydi,
// aynan belgilash paytida "shu kun uchun to'lov davom etsinmi" so'raladi:
// - chargeable=false: kun hisob-kitobdan BUTUNLAY chiqariladi (na hisoblanadi,
//   na to'lov so'raladi) — narx qolgan dars kunlariga qayta taqsimlanadi
//   (student.service.js "computeBilling" — lesson-day asosidagi hisoblash).
// - chargeable=true: faqat vizual belgi (masalan bayram tufayli dars
//   ko'chirilgan, lekin to'lov odatdagidek davom etadi) — billingga ta'sir
//   qilmaydi.
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
  },
  group: {
    type: Schema.Types.ObjectId,
    ref: "Group",
    required: true,
  },
  date: {
    type: String, // "YYYY-MM-DD"
    required: true,
  },
  chargeable: {
    type: Boolean,
    default: false,
  },
  // Nima uchun dam olish ekani (bayram, ta'mir, o'qituvchi kasal...) —
  // ixtiyoriy. Davomat matritsasida shu sana ustiga olib borilganda
  // izoh sifatida ko'rsatiladi.
  note: {
    type: String,
    default: "",
    trim: true,
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

schema.index({ group: 1, date: 1 }, { unique: true });

schema.pre("save", async function () {
  this.updatedAt = getNow();
});

module.exports = model("GroupHoliday", schema);
