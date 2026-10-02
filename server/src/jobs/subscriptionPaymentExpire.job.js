const SubscriptionPayment = require("../models/SubscriptionPayment");
const { getNow } = require("../utils/date.util");

const TICK_MS = 60_000;
const EXPIRE_AFTER_SECONDS = 15 * 60; // 15 daqiqa ichida to'lanmasa rad etiladi

// `updateMany` idempotent — cluster'dagi barcha worker'lar har tikda
// chaqirsa ham xavfsiz, alohida Redis qulfi shart emas (healthCheck/
// subscriptionReminder job'laridan farqli, u yerda bildirishnoma/email
// yuborilgani uchun qulf kerak edi).
const run = async () => {
  try {
    await SubscriptionPayment.updateMany(
      { status: "pending", createdAt: { $lte: getNow() - EXPIRE_AFTER_SECONDS } },
      { $set: { status: "cancelled" } },
    );
  } catch (error) {
    console.error("subscriptionPaymentExpire:", error.message);
  }
};

const start = () => {
  const timer = setInterval(() => {
    run().catch((error) => console.error("subscriptionPaymentExpire:", error.message));
  }, TICK_MS);
  timer.unref?.();
  console.log("Subscription payment expire scheduler started (har 60s, 15 daqiqa TTL)");
};

module.exports = { start, run };
