// SMS balans filial darajasiga o'tdi: `center`siz eski SmsPurchase/SmsTransaction'lar
// client'ning birinchi (eng eski, o'chirilmagan) filialiga biriktiriladi. Idempotent.
// Ishga tushirish: node scripts/migrate-sms-purchase-center.js
require("dotenv").config();
const mongoose = require("mongoose");
const envConfig = require("../src/configs/env.config");
const SmsPurchase = require("../src/models/SmsPurchase");
const SmsTransaction = require("../src/models/SmsTransaction");
const Center = require("../src/models/Center");

(async () => {
  await mongoose.connect(envConfig.MONGO_URI);
  const clients = await SmsPurchase.distinct("client", { center: null });
  let fixed = 0;
  for (const client of clients) {
    const center = await Center.findOne({ client, isDeleted: false }).sort({ createdAt: 1 }).select("_id").lean();
    if (!center) continue;
    const r = await SmsPurchase.updateMany({ client, center: null }, { $set: { center: center._id } });
    await SmsTransaction.updateMany({ client, center: null }, { $set: { center: center._id } });
    fixed += r.modifiedCount;
  }
  console.log(`[migrate-sms-purchase-center] ${clients.length} client, ${fixed} paket biriktirildi`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
