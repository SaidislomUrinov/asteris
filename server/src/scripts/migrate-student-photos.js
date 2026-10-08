// O'quvchi rasmi: umumiy `Student.photo` (string) → client darajasidagi
// `Student.photos[]` (API_CONTRACT_student_photo_per_client.md, 2026-10-08).
//
// `photo` maydoni mavjud har bir hujjat (raw collection — schema'da endi yo'q):
// - bo'sh bo'lmasa: har bir noyob `groups[].client` uchun `{ client, path: photo,
//   updatedAt: now }` elementi qo'shiladi (mavjud `photos` elementlari saqlanadi,
//   faqat elementi yo'q client'lar qo'shiladi);
// - so'ng `photo` `$unset` qilinadi. A'zoligi yo'q hujjatda — faqat `$unset`
//   (fayl diskda qoladi, o'chirilmaydi).
// Idempotent va cluster'da xavfsiz: yangilash sharti `photo` aynan o'qilgan
// qiymatga tengligi — ikkinchi worker/ishga tushish hech narsa qilmaydi.
//
// Qo'lda ishga tushirish (server/ ichidan): node src/scripts/migrate-student-photos.js
const mongoose = require("mongoose");
const { getNow } = require("../utils/date.util");

const migrateStudentPhotos = async () => {
  const col = mongoose.connection.db.collection("students");

  const docs = await col
    .find({ photo: { $exists: true } })
    .project({ photo: 1, photos: 1, "groups.client": 1 })
    .toArray();
  if (!docs.length) return { migrated: 0, cleared: 0 };

  const now = getNow();
  let migrated = 0;
  let cleared = 0;

  for (const doc of docs) {
    const path = typeof doc.photo === "string" ? doc.photo.trim() : "";
    const existing = Array.isArray(doc.photos) ? doc.photos : [];
    const have = new Set(existing.map((p) => String(p?.client)));

    const clients = [];
    if (path) {
      for (const g of doc.groups || []) {
        if (!g?.client) continue;
        const key = String(g.client);
        if (have.has(key)) continue;
        have.add(key);
        clients.push(g.client);
      }
    }

    const update = { $unset: { photo: "" } };
    if (clients.length) {
      const items = clients.map((client) => ({ client, path, updatedAt: now }));
      // `photos` hali yo'q/massiv emas bo'lsa — $set (null'ga $push xato beradi).
      if (Array.isArray(doc.photos)) update.$push = { photos: { $each: items } };
      else update.$set = { photos: items };
    } else if (!Array.isArray(doc.photos)) {
      update.$set = { photos: [] };
    }

    const res = await col.updateOne({ _id: doc._id, photo: doc.photo }, update);
    if (!res.modifiedCount) continue;
    if (clients.length) migrated += 1;
    else cleared += 1;
  }

  if (migrated || cleared) {
    console.log(`O'quvchi rasmlari client darajasiga ko'chirildi: ${migrated} ta, bo'sh/a'zoliksiz tozalandi: ${cleared} ta`);
  }
  return { migrated, cleared };
};

module.exports = migrateStudentPhotos;

if (require.main === module) {
  require("dotenv").config();
  (async () => {
    try {
      await mongoose.connect(process.env.MONGO_URI);
      const res = await migrateStudentPhotos();
      console.log(`done: ${JSON.stringify(res)}`);
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    } finally {
      await mongoose.disconnect();
    }
  })();
}
