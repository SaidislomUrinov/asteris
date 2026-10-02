// Bir martalik migratsiya: `parent.notifications` tarif flagi butunlay
// olib tashlandi (ota-ona nazorati endi har bir filial uchun doim ochiq),
// shuning uchun eski tarif hujjatlarida qolib ketgan kalit tozalanadi.
// Aks holda o'sha hujjatni keyingi saqlashda Mongoose enum validatsiyasi
// yiqiladi va mijozga "Tarif imkoniyatlari" ro'yxatida xom kalit ko'rinadi.
//
// Ishlatish (istalgan papkadan): node server/scripts/remove-parent-notifications-flag.js
//
// `.env` __dirname'ga nisbatan topiladi (ecosystem.config.js bilan bir xil
// yondashuv) — aks holda skript `scripts/` ichidan chaqirilsa dotenv joriy
// papkadan `.env` qidirib topolmaydi va MONGO_URI `undefined` bo'lib qoladi.
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

(async () => {
  try {
    if (!process.env.MONGO_URI) throw new Error("MONGO_URI topilmadi — server/.env mavjudligini tekshiring.");
    await mongoose.connect(process.env.MONGO_URI);
    const Tariff = require("../src/models/Tariff");
    const Subscription = require("../src/models/Subscription");

    const t = await Tariff.updateMany(
      { allowedPermissions: "parent.notifications" },
      { $pull: { allowedPermissions: "parent.notifications" } },
    );
    // Obunadagi tarif "snapshot"i ham saqlanadi — u ham tozalanadi.
    const s = await Subscription.updateMany(
      { "tariffSnapshot.allowedPermissions": "parent.notifications" },
      { $pull: { "tariffSnapshot.allowedPermissions": "parent.notifications" } },
    );

    console.log(`Tariff: ${t.modifiedCount} ta, Subscription snapshot: ${s.modifiedCount} ta tozalandi.`);
  } catch (error) {
    console.error("Migratsiya xatosi:", error?.message || error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
