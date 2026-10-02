// Bir martalik tozalash: "Guruh bo'yicha" oylik turi (2026-09-06) koddan
// olib tashlangan, lekin eski Tariff / Subscription.tariffSnapshot
// hujjatlarida `staff.salary.perGroup` kaliti qolib ketgan bo'lishi mumkin —
// /subscription "Imkoniyatlar" ro'yxatida xom kalit bo'lib chiqardi.
//
// Ishga tushirish (server/ ichidan): node src/scripts/remove-pergroup-permission.js
require("dotenv").config();
const mongoose = require("mongoose");

const KEY = "staff.salary.perGroup";

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;

    const tariffs = await db
      .collection("tariffs")
      .updateMany({ allowedPermissions: KEY }, { $pull: { allowedPermissions: KEY } });
    const subs = await db
      .collection("subscriptions")
      .updateMany(
        { "tariffSnapshot.allowedPermissions": KEY },
        { $pull: { "tariffSnapshot.allowedPermissions": KEY } },
      );

    console.log(`tariffs: ${tariffs.modifiedCount}, subscriptions: ${subs.modifiedCount}`);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
