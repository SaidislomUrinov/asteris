// Boshlang'ich SMS paketlar. Takror ishga tushirilsa mavjud nomli paket qayta yaratilmaydi.
require("dotenv").config();
const mongoose = require("mongoose");
const env = require("../src/configs/env.config");
const SmsPackage = require("../src/models/SmsPackage");

const PACKAGES = [
  { name: "Start", smsCount: 500, price: 30000, validityDays: 30, order: 1 },
  { name: "Standart", smsCount: 1000, price: 55000, validityDays: 30, order: 2 },
  { name: "Biznes", smsCount: 5000, price: 250000, validityDays: 30, order: 3 },
];

(async () => {
  await mongoose.connect(env.MONGO_URI);
  for (const p of PACKAGES) {
    const exists = await SmsPackage.findOne({ name: p.name });
    if (exists) {
      console.log("mavjud:", p.name);
      continue;
    }
    await SmsPackage.create(p);
    console.log("yaratildi:", p.name);
  }
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
