// WECOIN tangalarini oy yakuni uchun QO'LDA tarqatish (API_CONTRACT_wecoin.md §5).
// Job (jobs/badges.job.js) bilan AYNAN bir xil mantiq — coin.service.distributeMonth
// + notifyMonth. Medal tangalari uchun avval o'sha oy medallari berilgan bo'lishi
// kerak (award-badges.js). Idempotent: bir oy bir o'quvchiga bir marta.
//
// Ishga tushirish (server/ ichidan):
//   node src/scripts/distribute-coins.js 2026-09              # tarqatadi + Telegram
//   node src/scripts/distribute-coins.js 2026-09 --no-notify  # Telegram'ni job 10:00 da yuboradi
require("dotenv").config();
const mongoose = require("mongoose");
const redis = require("../configs/redis.config");
const coinService = require("../services/coin.service");

(async () => {
  const month = process.argv[2];
  const notify = !process.argv.includes("--no-notify");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || "")) {
    console.error("Foydalanish: node src/scripts/distribute-coins.js YYYY-MM [--no-notify]");
    process.exit(1);
  }
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const report = await coinService.distributeMonth(month);
    console.log(
      `${month}: ${report.coins} tanga, ${report.students} o'quvchi (${report.centers} filial, tarif sabab o'tkazildi: ${report.skippedTariff})`,
    );
    if (notify) {
      const sent = await coinService.notifyMonth(month);
      console.log(`Telegram xabar: ${sent.sent}/${sent.total}`);
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    redis.disconnect?.();
  }
})();
