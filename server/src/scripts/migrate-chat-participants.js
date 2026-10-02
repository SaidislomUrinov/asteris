// Qo'llab-quvvatlash chati: "Client uchun bitta umumiy suhbat" dan "har bir
// odam (Owner / har Staff) uchun alohida suhbat" ga o'tish (2026-09-26).
//
// 1) Eski `clientId` UNIQUE indeksi olib tashlanadi — aks holda bitta
//    Client'ga ikkinchi suhbat (hodimniki) yaratib bo'lmaydi.
// 2) `participant` maydoni yo'q eski suhbatlar Client Owner'ga biriktiriladi
//    (butun eski tarix owner suhbatida qoladi).
// Idempotent va cluster'da xavfsiz — connectDB() ichida har ishga tushishda.
//
// Qo'lda ishga tushirish (server/ ichidan): node src/scripts/migrate-chat-participants.js
const mongoose = require("mongoose");

const migrateChatParticipants = async () => {
  const db = mongoose.connection.db;
  const col = db.collection("chatconversations");

  try {
    const indexes = await col.indexes();
    const legacy = indexes.find((i) => i.unique && i.key && Object.keys(i.key).join() === "clientId");
    if (legacy) await col.dropIndex(legacy.name);
  } catch {
    // kolleksiya hali yo'q yoki indeks boshqa worker tomonidan allaqachon o'chirilgan
  }

  const legacyDocs = await col.find({ participant: { $exists: false } }).project({ clientId: 1 }).toArray();
  if (!legacyDocs.length) return 0;

  const clients = await db
    .collection("clients")
    .find({ _id: { $in: legacyDocs.map((d) => d.clientId) } })
    .project({ name: 1 })
    .toArray();
  const nameOf = Object.fromEntries(clients.map((c) => [String(c._id), c.name || ""]));

  let n = 0;
  for (const doc of legacyDocs) {
    const res = await col.updateOne(
      { _id: doc._id, participant: { $exists: false } },
      {
        $set: {
          participant: {
            kind: "client",
            id: doc.clientId,
            name: nameOf[String(doc.clientId)] || "",
            role: "",
            centerId: null,
            centerName: "",
          },
        },
      },
    );
    n += res.modifiedCount;
  }
  if (n) console.log(`Chat suhbatlari owner'ga biriktirildi: ${n} ta`);
  return n;
};

module.exports = migrateChatParticipants;

if (require.main === module) {
  require("dotenv").config();
  (async () => {
    try {
      await mongoose.connect(process.env.MONGO_URI);
      const n = await migrateChatParticipants();
      console.log(`done: ${n}`);
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    } finally {
      await mongoose.disconnect();
    }
  })();
}
