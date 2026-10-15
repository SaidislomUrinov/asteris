// Brend subdomeni + ko'p filialli hodim (docs/API_CONTRACT_multi_center.md §7) —
// server ishga tushganda AVTOMATIK (connectDB). Qo'lda skriptni
// (server/scripts/migrate-multi-center.js) unutib qo'yish ma'lumotni buzmasligi
// uchun: aks holda `centers` bo'sh eski hodimlar `{ centers: X }` filtrlariga
// tushmay, Hodimlar/Oylik/Hisobot ro'yxatlari bo'sh chiqardi.
//
// Idempotent va cluster'da xavfsiz (bir nechta worker bir vaqtda ishga tushsa ham):
//   1. Staff.centers bo'sh        → [center];  salaryValues bo'sh → [{center, value: salaryValue}]
//   2. Staff `login_1` (global unique) → o'chiriladi, agar mijoz ichida dublikat yo'q bo'lsa
//   3. Client.slug yo'q           → nomdan avtomatik (keyin admin panelda o'zgartirsa,
//                                   eski manzil yangisiga yo'naltiriladi)
const mongoose = require("mongoose");
const slugUtil = require("../utils/slug.util");

const migrateMultiCenter = async () => {
  const db = mongoose.connection.db;
  const staffs = db.collection("staffs");
  const clients = db.collection("clients");

  // 1. Hodim filiallari va filial bo'yicha oylik qiymati.
  const centersRes = await staffs.updateMany(
    { center: { $ne: null }, $or: [{ centers: { $exists: false } }, { centers: { $size: 0 } }] },
    [{ $set: { centers: ["$center"] } }],
  );
  const salaryRes = await staffs.updateMany(
    { center: { $ne: null }, $or: [{ salaryValues: { $exists: false } }, { salaryValues: { $size: 0 } }] },
    [{ $set: { salaryValues: [{ center: "$center", value: { $ifNull: ["$salaryValue", null] } }] } }],
  );

  // 2. Global login indeksi — mijoz ichidagi dublikat bo'lmasa olib tashlanadi
  //    (yangi `{client, login}` indeksini Mongoose autoIndex yaratadi).
  try {
    const legacy = (await staffs.indexes()).find((i) => i.name === "login_1");
    if (legacy) {
      const dups = await staffs
        .aggregate([
          { $match: { isDeleted: false } },
          { $group: { _id: { client: "$client", login: "$login" }, n: { $sum: 1 } } },
          { $match: { n: { $gt: 1 } } },
          { $limit: 1 },
        ])
        .toArray();
      if (!dups.length) await staffs.dropIndex("login_1");
      else console.error("Staff login_1 indeksi qoldirildi: mijoz ichida takrorlangan login bor");
    }
  } catch {
    // boshqa worker allaqachon o'chirgan
  }

  // 3. Brend slug'i yo'q mijozlar.
  const missing = await clients
    .find({ isDeleted: false, $or: [{ slug: { $exists: false } }, { slug: null }, { slug: "" }] })
    .project({ name: 1 })
    .sort({ createdAt: 1 })
    .toArray();
  const created = [];
  for (const c of missing) {
    const taken = async (s) => !!(await clients.findOne({ isDeleted: false, $or: [{ slug: s }, { previousSlugs: s }] }));
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const slug = await slugUtil.suggest(c.name, taken);
      try {
        // Faqat hali bo'sh bo'lsa — parallel worker yozib ulgurgan bo'lsa tegilmaydi.
        const res = await clients.updateOne(
          { _id: c._id, $or: [{ slug: { $exists: false } }, { slug: null }, { slug: "" }] },
          { $set: { slug } },
        );
        if (res.modifiedCount) created.push(`${c.name} → ${slug}`);
        break;
      } catch (error) {
        if (error?.code !== 11000) throw error; // unique to'qnashuv — boshqa variant
      }
    }
  }

  if (centersRes.modifiedCount || salaryRes.modifiedCount || created.length) {
    console.log(
      `Ko'p filial migratsiyasi: hodim filiallari ${centersRes.modifiedCount}, oylik qiymatlari ${salaryRes.modifiedCount}` +
        (created.length ? `; yangi brend manzillari: ${created.join(", ")}` : ""),
    );
  }
};

module.exports = migrateMultiCenter;
