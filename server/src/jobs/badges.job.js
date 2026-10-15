// OYLIK YUTUQ NISHONLARI VA REYTING MEDALLARI (API_CONTRACT_badges_monthly_rank.md §C).
//
// Har 5 daqiqada tekshiradi, O'TGAN oy uchun ikki bosqich:
//  1. BERISH — Tashkent vaqti AWARD_FROM_HOUR dan keyin (odatda 1-sana 06:00):
//     badge.service.awardMonth nishon + 1/2/3-o'rin medallarini yozadi, WebApp
//     "Yutuqlar" bo'limida darhol ko'rinadi. Tun yarmida emas — kechki darslar
//     davomati/bahosi ertalabgacha kiritib bo'linsin.
//  2. XABAR — SEND_FROM_HOUR..SEND_TO_HOUR oralig'ida (odatda 10:00):
//     badge.service.notifyMonth ota-onaga Telegram xabarini yuboradi. Kunduzgi
//     oyna ataylab: `notify()` markazning quietHours'ini tekshirmaydi.
// Server 1-sanada o'chiq bo'lsa ham keyingi ishga tushishda (shu oy ichida)
// baribir bajaradi. Cluster'da Redis qulfi (SET NX) — bir vaqtda faqat bitta
// worker; har bosqichdan keyin `done` flagi 60 kun turadi. Xato bo'lsa qulf
// bo'shatiladi va keyingi tick'da qayta urinadi (ikkala bosqich idempotent).
const moment = require("moment-timezone");
const redis = require("../configs/redis.config");
const keyConfig = require("../configs/key.config");
const badgeService = require("../services/badge.service");
const coinService = require("../services/coin.service");

const TZ = "Asia/Tashkent";
const TICK_MS = 5 * 60 * 1000;
const AWARD_FROM_HOUR = 6;
// Xabar yuborish oynasi (soat, Asia/Tashkent) — parentDebt.job 10:00 bilan bir xil.
const SEND_FROM_HOUR = 10;
const SEND_TO_HOUR = 20;
const LOCK_TTL_SEC = 30 * 60;
const DONE_TTL_SEC = 60 * 24 * 3600;

// Bitta bosqichni qulf + done flagi bilan bajaradi.
const once = async (doneKey, fn) => {
  if (await redis.get(doneKey)) return;
  const lockKey = `${doneKey}:lock`;
  if ((await redis.set(lockKey, String(process.pid), "EX", LOCK_TTL_SEC, "NX")) !== "OK") return;
  try {
    await fn();
    await redis.set(doneKey, "1", "EX", DONE_TTL_SEC);
  } finally {
    await redis.del(lockKey);
  }
};

const run = async () => {
  const now = moment.tz(TZ);
  if (now.hour() < AWARD_FROM_HOUR) return;
  const month = now.clone().startOf("month").subtract(1, "month").format("YYYY-MM");

  await once(keyConfig.badgesDone(month), async () => {
    const report = await badgeService.awardMonth(month);
    console.log(
      `Badges ${month}: ${report.inserted} awarded, ${report.medals} medals (${report.groups} groups, ${report.skippedTariff} skipped by tariff)`,
    );
  });

  // WECOIN (API_CONTRACT_wecoin.md §5) — medallar yozilgandan KEYIN (medal
  // tangalari StudentMedal'dan hisoblanadi).
  if (await redis.get(keyConfig.badgesDone(month))) {
    await once(keyConfig.coinsDone(month), async () => {
      const report = await coinService.distributeMonth(month);
      console.log(
        `Coins ${month}: ${report.coins} coins to ${report.students} students (${report.centers} centers, ${report.skippedTariff} skipped by tariff)`,
      );
    });
  }

  // Xabar faqat berish bajarilgandan keyin (flag bor) va kunduzgi oynada.
  if (now.hour() < SEND_FROM_HOUR || now.hour() >= SEND_TO_HOUR) return;
  if (!(await redis.get(keyConfig.badgesDone(month)))) return;
  await once(keyConfig.badgesNotified(month), async () => {
    const report = await badgeService.notifyMonth(month);
    console.log(`Badges ${month}: notified ${report.sent}/${report.entries} entries`);
  });
  // Tanga xabarlari — idempotent (`CoinTransaction.notified`), flag kerak emas.
  if (await redis.get(keyConfig.coinsDone(month))) {
    const report = await coinService.notifyMonth(month);
    if (report.total) console.log(`Coins ${month}: notified ${report.sent}/${report.total}`);
  }
};

const start = () => {
  const tick = () => run().catch((error) => console.error("badges:", error.message));
  // Ishga tushgandan biroz keyin bir marta (restartdan keyin 5 daqiqa kutmasin).
  setTimeout(tick, 30 * 1000).unref?.();
  const timer = setInterval(tick, TICK_MS);
  timer.unref?.();
  console.log(`Badges scheduler started (monthly, 1st day: award ${AWARD_FROM_HOUR}:00, notify ${SEND_FROM_HOUR}:00–${SEND_TO_HOUR}:00)`);
};

module.exports = { start, run };
