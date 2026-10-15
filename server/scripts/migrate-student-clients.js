// O'quvchilar mijoz (brend) bo'yicha — HISOBOT / qo'lda ishga tushirish.
// Odatda kerak emas: migratsiya server ishga tushganda avtomatik bajariladi
// (src/scripts/migrate-student-clients.js, connectDB). Bu skript deploy'dan
// OLDIN nima bo'lishini ko'rish uchun:
//
//   cd server && node scripts/migrate-student-clients.js --dry-run   # faqat hisobot
//   cd server && node scripts/migrate-student-clients.js             # qo'lda bajarish
//
// Hech narsa o'chirilmaydi: asl hujjatlar `students_backup_20261016` kolleksiyasida.
require("dotenv").config();
const mongoose = require("mongoose");
const env = require("../src/configs/env.config");
const migration = require("../src/scripts/migrate-student-clients");

const DRY_RUN = process.argv.includes("--dry-run");

(async () => {
  await mongoose.connect(env.MONGO_URI);
  console.log(`Baza: ${mongoose.connection.name}${DRY_RUN ? " (dry-run)" : ""}`);
  if (DRY_RUN) {
    const r = await migration.run({ dryRun: true });
    console.log(`Bitta mijozli: ${r.single}, guruhsiz (tegilmaydi): ${r.orphan}, bo'linadigan: ${r.split.length}`);
    r.split.forEach((line) => console.log(`  ${line}`));
  } else {
    await migration();
    console.log("Tugadi.");
  }
  await mongoose.disconnect();
  process.exit(0);
})().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
