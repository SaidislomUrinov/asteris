// Boshlang'ich SMS shablonlar (Qarzdorlik, Darsga kelmadi). Takror ishga
// tushirilsa mavjud sarlavhali shablon qayta yaratilmaydi.
require("dotenv").config();
const mongoose = require("mongoose");
const env = require("../src/configs/env.config");
const SmsTemplate = require("../src/models/SmsTemplate");

const TEMPLATES = [
  {
    title: "Qarzdorlik eslatmasi",
    topic: "debt",
    order: 1,
    text: "Hurmatli ota-ona! {student}ning {group} guruhi bo'yicha {month} uchun to'lov qarzi {debt}. Iltimos, to'lovni amalga oshiring. {center}",
  },
  {
    title: "Darsga kelmadi",
    topic: "absent",
    order: 2,
    text: "Hurmatli ota-ona! {student} {date} kuni {group} darsiga kelmadi. Sababini {center} ga xabar bering.",
  },
];

(async () => {
  await mongoose.connect(env.MONGO_URI);
  for (const t of TEMPLATES) {
    const exists = await SmsTemplate.findOne({ title: t.title });
    if (exists) {
      console.log("mavjud:", t.title);
      continue;
    }
    await SmsTemplate.create(t);
    console.log("yaratildi:", t.title);
  }
  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
