// Bir martalik tuzatish: Tarif tahrirlanganda joriy obunalar avtomatik
// yangilanishidan (clientService.syncSubscriptionsWithTariff, 2026-09-26)
// OLDIN o'zgartirilgan tariflar sabab JORIY obunalarning `tariffSnapshot`i
// eskirib qolgan bo'lishi mumkin. Shu skript ularni hozirgi Tariff holatiga
// keltiradi va owner'larning Redis sessiya keshini tashlaydi (unda eski
// ruxsatlar muzlab qolgan — keyingi so'rovda bazadan yangisi quriladi).
// `price` va tarixiy ("changed"/"cancelled") obunalarga tegilmaydi.
//
// Ishga tushirish (server/ ichidan): node src/scripts/sync-tariff-snapshots.js
require("dotenv").config();
const mongoose = require("mongoose");
const redis = require("../configs/redis.config");
const keyConfig = require("../configs/key.config");

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;

    const clients = await db
      .collection("clients")
      .find({ isDeleted: false, subscription: { $ne: null } })
      .project({ _id: 1, subscription: 1 })
      .toArray();

    let updated = 0;
    for (const client of clients) {
      const sub = await db.collection("subscriptions").findOne({ _id: client.subscription });
      const tariff = sub && (await db.collection("tariffs").findOne({ _id: sub.tariff }));
      if (!tariff) continue;

      const res = await db.collection("subscriptions").updateOne(
        { _id: sub._id },
        {
          $set: {
            "tariffSnapshot.name": tariff.name,
            "tariffSnapshot.studentLimit": tariff.studentLimit,
            "tariffSnapshot.centerLimit": tariff.centerLimit,
            "tariffSnapshot.teacherLimit": tariff.teacherLimit,
            "tariffSnapshot.receptionLimit": tariff.receptionLimit,
            "tariffSnapshot.allowedPermissions": tariff.allowedPermissions || [],
          },
        },
      );
      if (res.modifiedCount) updated++;
      await redis.del(keyConfig.client(client._id));
    }

    console.log(`clients: ${clients.length}, subscriptions updated: ${updated}`);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    redis.disconnect();
  }
})();
