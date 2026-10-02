// Baholarni 5 ballikdan 10 ballikka o'tkazish (2026-09-22,
// API_CONTRACT_grade_scale10.md §3).
//
// Eski hujjatlarda `scale` maydoni YO'Q — ular 5 ballik. Har biri BIR MARTA
// atomar yangilanadi: value ← value × 2, scale ← 10. Filtr `scale` yo'qligiga
// tayangani uchun idempotent va cluster'da (bir nechta worker bir vaqtda
// chaqirsa ham) xavfsiz — connectDB() ichida har ishga tushishda chaqiriladi.
//
// Qo'lda ishga tushirish (server/ ichidan): node src/scripts/migrate-grade-scale.js
const mongoose = require("mongoose");

const migrateGradeScale = async () => {
  const result = await mongoose.connection.db.collection("grades").updateMany(
    { scale: { $exists: false } },
    [{ $set: { value: { $multiply: ["$value", 2] }, scale: 10 } }],
  );
  if (result.modifiedCount) {
    console.log(`Baholar 10 ballikka o'tkazildi: ${result.modifiedCount} ta`);
  }
  return result.modifiedCount;
};

module.exports = migrateGradeScale;

if (require.main === module) {
  require("dotenv").config();
  (async () => {
    try {
      await mongoose.connect(process.env.MONGO_URI);
      const n = await migrateGradeScale();
      console.log(`done: ${n}`);
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    } finally {
      await mongoose.disconnect();
    }
  })();
}
