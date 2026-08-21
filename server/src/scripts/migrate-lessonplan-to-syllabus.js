/**
 * Bir martalik migratsiya: eski `LessonPlan` yozuvlari → yangi `Syllabus`.
 *
 * Har guruhning barcha rejalari (order bo'yicha) BITTA "Modul 1" ichiga
 * dars sifatida ko'chiriladi — eski modelda modul tushunchasi yo'q edi,
 * shuning uchun tabiiy moslik shu.
 *
 * IDEMPOTENT: guruhda allaqachon Syllabus bo'lsa o'tkazib yuboriladi, ya'ni
 * skriptni bir necha marta ishga tushirish xavfsiz.
 *
 * Ishga tushirish:  node src/scripts/migrate-lessonplan-to-syllabus.js
 */
require("dotenv").config();
const mongoose = require("mongoose");

const Syllabus = require("../models/Syllabus");
const Group = require("../models/Group");

// LessonPlan modeli migratsiyadan keyin O'CHIRILADI, shuning uchun uning
// collection'iga to'g'ridan-to'g'ri (schema'siz) murojaat qilamiz — skript
// o'chirilgan fayldan mustaqil bo'lib qoladi.
const DEFAULT_MODULE_TITLE = "Modul 1";

const run = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI topilmadi (.env)");

  await mongoose.connect(uri);
  const plansCollection = mongoose.connection.collection("lessonplans");

  const plans = await plansCollection
    .find({ isDeleted: { $ne: true } })
    .sort({ group: 1, order: 1, createdAt: 1 })
    .toArray();

  // Guruh bo'yicha guruhlash — tartib yuqoridagi sort orqali saqlanadi.
  const byGroup = new Map();
  for (const plan of plans) {
    const key = String(plan.group);
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key).push(plan);
  }

  let created = 0;
  let skipped = 0;
  let missingGroup = 0;

  for (const [groupId, groupPlans] of byGroup) {
    const exists = await Syllabus.exists({ group: groupId });
    if (exists) {
      skipped += 1;
      continue;
    }

    // Guruh o'chirilgan/yo'qolgan bo'lsa client/center'ni rejadan olamiz.
    const group = await Group.findOne({ _id: groupId });
    const client = group?.client || groupPlans[0].client;
    const center = group?.center || groupPlans[0].center;
    if (!client || !center) {
      missingGroup += 1;
      continue;
    }

    await Syllabus.create({
      client,
      center,
      group: groupId,
      modules: [
        {
          title: DEFAULT_MODULE_TITLE,
          lessons: groupPlans.map((p) => ({
            title: p.title,
            description: p.description || "",
            homework: p.homework || "",
          })),
        },
      ],
    });
    created += 1;
  }

  console.log(
    `Migratsiya yakunlandi: ${plans.length} ta reja, ${byGroup.size} ta guruh — ` +
      `yaratildi: ${created}, o'tkazib yuborildi (allaqachon bor): ${skipped}, ` +
      `client/center topilmadi: ${missingGroup}`,
  );

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("Migratsiya xatosi:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
