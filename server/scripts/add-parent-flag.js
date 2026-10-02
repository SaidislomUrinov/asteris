// Bir martalik: dev bazadagi "Premium Demo" tarifiga `parent.notifications`
// flagini qo'shadi (API_CONTRACT_parent.md §1). Qayta ishga tushirilsa
// hech narsa buzilmaydi ($addToSet).
//
// Ishlatish: node scripts/add-parent-flag.js [tarif nomi]
require("dotenv").config();
const mongoose = require("mongoose");
const Tariff = require("../src/models/Tariff");

const FLAG = "parent.notifications";
const NAME = process.argv[2] || "Premium Demo";

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const res = await Tariff.updateOne({ name: NAME }, { $addToSet: { allowedPermissions: FLAG } });
  if (!res.matchedCount) console.log(`Tarif topilmadi: "${NAME}"`);
  else console.log(`"${NAME}": ${res.modifiedCount ? "flag qo'shildi" : "flag allaqachon bor"} (${FLAG})`);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
