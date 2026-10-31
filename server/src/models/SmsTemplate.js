const { Schema, model } = require("mongoose");
const { getNow } = require("../utils/date.util");

const TOPICS = ["debt", "absent", "payment", "lesson", "info"];
// Matndagi {o'zgaruvchi}lar — yuborish paytida har o'quvchi uchun to'ldiriladi.
const VARIABLES = ["center", "student", "group", "price", "debt", "month", "date"];

// Platform Admin tayyorlaydigan global SMS shablon; filiallar faqat tanlaydi.
const schema = new Schema({
  title: { type: String, required: true, trim: true },
  topic: { type: String, enum: TOPICS, default: "info" },
  text: { type: String, required: true, trim: true },
  active: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
  createdAt: { type: Number, default: getNow },
  updatedAt: { type: Number, default: getNow },
});

schema.pre("save", async function () {
  this.updatedAt = getNow();
});

schema.statics.TOPICS = TOPICS;
schema.statics.VARIABLES = VARIABLES;

module.exports = model("SmsTemplate", schema);
