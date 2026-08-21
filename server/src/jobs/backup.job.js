const moment = require("moment-timezone");
const redis = require("../configs/redis.config");
const SystemSetting = require("../models/SystemSetting");
const systemSettingService = require("../services/systemSetting.service");
const { sendAlert } = require("../bot/alert");
const { getNow } = require("../utils/date.util");

const TZ = "Asia/Tashkent";
const TICK_MS = 60_000;

// ioredis `keyPrefix` ni o'zi qo'shadi — yakuniy kalit
// `asteris:scheduler:backup:{YYYY-MM-DD}`.
const lockKey = (day) => `scheduler:backup:${day}`;

const acquireDailyLock = async (day) => {
  try {
    const res = await redis.set(lockKey(day), "1", "EX", 90_000, "NX");
    return res === "OK";
  } catch {
    return false;
  }
};

const run = async () => {
  const settings = await systemSettingService.getRaw();
  const backup = settings?.backup;
  if (!backup?.enabled) return;

  // `cron` bu yerda oddiy "HH:mm" (tashqi cron kutubxonasi kerak emas —
  // backup kuniga bir marta, aniq soatda bo'ladi).
  const [hour, minute] = String(backup.cron || "03:00").split(":").map(Number);
  const now = moment().tz(TZ);
  if (now.hour() !== hour || now.minute() !== minute) return;

  const day = now.format("YYYY-MM-DD");
  if (!(await acquireDailyLock(day))) return;

  try {
    const result = await systemSettingService.runBackup();
    await systemSettingService.cleanOldBackups(backup.keepDays ?? 7);

    console.log(`Backup done: ${result.file} (${result.sizeMb} MB)`);
  } catch (error) {
    // Backup uddalanmasa server ishlayveradi, lekin admin bilishi SHART.
    try {
      await SystemSetting.updateOne(
        { key: "global" },
        { $set: { "backup.lastRunAt": getNow(), "backup.lastStatus": `failed: ${error.message}` } },
      );
      await systemSettingService.invalidate();
    } catch {
      // ...
    }

    await sendAlert(
      "serverError",
      {
        title: "Backup bajarilmadi",
        body: error.message || "Noma'lum xato",
        meta: { Vaqt: now.format("DD.MM.YYYY HH:mm") },
      },
      { throttle: false },
    );
  }
};

const start = () => {
  const timer = setInterval(() => {
    run().catch((error) => console.error("backup:", error.message));
  }, TICK_MS);
  timer.unref?.();
  console.log("Backup scheduler started (SystemSetting.backup.cron bo'yicha)");
};

module.exports = { start, run };
