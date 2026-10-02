// Oylik yutuq nishonlari va 1/2/3-o'rin medallarini QO'LDA berish
// (API_CONTRACT_badges_monthly_rank.md §C). Job (jobs/badges.job.js) bilan
// AYNAN bir xil mantiq — badge.service.awardMonth + notifyMonth.
// Idempotent: qayta ishga tushirilsa allaqachon berilganlar takrorlanmaydi,
// xabar ham faqat hali xabar qilinmagan nishonlar uchun ketadi.
//
// Ishga tushirish (server/ ichidan):
//   node src/scripts/award-badges.js 2026-08              # beradi + Telegram + socket
//   node src/scripts/award-badges.js 2026-08 --no-notify  # beradi, Telegram xabarini job 10:00 da yuboradi
//   node src/scripts/award-badges.js 2026-08 --dry        # faqat ko'rsatadi, yozmaydi
//   node src/scripts/award-badges.js 2026-07 --medals-only # faqat 1/2/3-o'rin medallari (o'tgan
//                                                          # oylar tarixi; eskidan yangiga ishga tushiring)
require("dotenv").config();
const mongoose = require("mongoose");
const redis = require("../configs/redis.config");
const badgeService = require("../services/badge.service");
const { MONTH_RE } = require("../utils/gradeScore.util");

(async () => {
  const month = process.argv[2];
  const dry = process.argv.includes("--dry");
  const medalsOnly = process.argv.includes("--medals-only");
  const notify = !dry && !medalsOnly && !process.argv.includes("--no-notify");
  if (!MONTH_RE.test(month || "")) {
    console.error("Foydalanish: node src/scripts/award-badges.js YYYY-MM [--dry | --no-notify | --medals-only]");
    process.exit(1);
  }
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const report = await badgeService.awardMonth(month, { dry, medalsOnly });
    for (const a of report.awarded) {
      console.log(`${a.groupName || a.group} · ${a.student} · ${a.type} ${JSON.stringify(a.meta)}`);
    }
    console.log(
      `${dry ? "[DRY] " : ""}${month}: ${report.awarded.length} ta yangi nishon/medal` +
        `${dry ? "" : `, yozildi: ${report.inserted} nishon, ${report.medals} medal`} (${report.groups} guruh, tarif sabab o'tkazildi: ${report.skippedTariff})`,
    );
    if (notify) {
      const sent = await badgeService.notifyMonth(month);
      console.log(`Telegram xabar: ${sent.sent}/${sent.entries} a'zolik`);
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    redis.disconnect();
  }
})();
