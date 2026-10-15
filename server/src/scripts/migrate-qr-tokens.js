// QR karta mijoz bo'yicha alohida (Student.qrTokens) — server ishga tushganda
// AVTOMATIK (connectDB), idempotent va cluster'da xavfsiz.
//
// Eski umumiy `qrToken` bor, `qrTokens` hali bo'sh o'quvchilarga: o'quvchi
// a'zo bo'lgan HAR BIR mijoz uchun xuddi shu token yoziladi — avval chop
// etilgan kartalar hamma markazda ishlashda davom etadi. Keyin biror markaz
// "yangilash" bossa, faqat o'zining yozuvi almashadi.
const mongoose = require("mongoose");

const migrateQrTokens = async () => {
  const col = mongoose.connection.db.collection("students");
  const res = await col.updateMany(
    {
      qrToken: { $type: "string" },
      $or: [{ qrTokens: { $exists: false } }, { qrTokens: { $size: 0 } }],
    },
    [
      {
        $set: {
          qrTokens: {
            $map: {
              input: { $setUnion: [{ $ifNull: ["$groups.client", []] }, []] },
              as: "c",
              in: { client: "$$c", token: "$qrToken" },
            },
          },
        },
      },
    ],
  );
  if (res.modifiedCount) console.log(`QR kartalar mijoz bo'yicha ajratildi: ${res.modifiedCount} ta o'quvchi`);
};

module.exports = migrateQrTokens;
