// Yuborilgan lekin hali "delivered" bo'lmagan SMS'larning yetkazilish holatini
// getsms.uz'dan so'raydi. Har 2 daqiqada; cluster'da Redis tick qulfi bilan
// faqat bitta worker ishlaydi. Shu tickda muddati o'tgan SMS paket qoldig'i ham yoziladi. 48 soatdan eski yozuvlar tekshirilmaydi.
const redis = require("../configs/redis.config");
const keyConfig = require("../configs/key.config");
const SmsLog = require("../models/SmsLog");
const smsService = require("../services/sms.service");
const smsBalance = require("../utils/smsBalance.util");
const { getNow } = require("../utils/date.util");

const TICK_MS = 2 * 60 * 1000;
const MAX_AGE = 48 * 3600;
const PER_TICK = 200;

const run = async () => {
  const tick = Math.floor(Date.now() / TICK_MS);
  if ((await redis.set(keyConfig.schedulerLock("smsStatus", tick), "1", "EX", 300, "NX")) !== "OK") return;
  // Muddati o'tgan paket qoldig'i `expire` tranzaksiyasi sifatida bir marta yoziladi.
  await smsBalance.expireDue().catch((e) => console.error("[smsExpire]", e));
  const logs = await SmsLog.find({ status: "sent", sentAt: { $gte: getNow() - MAX_AGE } })
    .sort({ sentAt: 1 })
    .limit(PER_TICK);
  if (logs.length) await smsService.refreshLogs(logs);
};

module.exports = {
  run,
  start: () => {
    setInterval(() => run().catch((e) => console.error("[smsStatus]", e)), TICK_MS).unref();
  },
};
