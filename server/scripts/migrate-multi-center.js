// Deploy'da MAJBURIY (docs/API_CONTRACT_multi_center.md §7): brend subdomeni +
// ko'p filialli hodim. Kod deploy qilingach, server qayta ishga tushishidan
// OLDIN yoki darhol keyin ishga tushiriladi.
//
//   1. Staff.centers bo'sh            → [center]               (asosiy filial)
//   2. Staff.salaryValues bo'sh       → [{ center, value: salaryValue }]
//   3. SalaryTransaction.center yo'q  → hodimning asosiy filiali (odatda 0 ta)
//   4. Staff indekslari: eski global `login_1` O'CHIRILADI, `{client, login}`
//      unique yaratiladi (oldin mijoz ichida dublikat login yo'qligi tekshiriladi)
//   5. Client.slug yo'q               → nomdan generatsiya (yoki --slug bilan qo'lda)
//
// Idempotent: qayta ishga tushirish xavfsiz — faqat to'ldirilmagan hujjatlarga tegadi.
//
//   cd server && node scripts/migrate-multi-center.js --dry-run
//   cd server && node scripts/migrate-multi-center.js
//   cd server && node scripts/migrate-multi-center.js --slug 6a1f...=primeacademy
//
// `--slug <clientObjectId>=<slug>` bir necha marta berilishi mumkin; berilmagan
// mijozlarga nomdan avtomatik slug qo'yiladi. Natija oxirida chop etiladi —
// shu manzillarni mijozlarga yuboring: https://<slug>.wenet.uz
require("dotenv").config();
const mongoose = require("mongoose");
const env = require("../src/configs/env.config");
const Staff = require("../src/models/Staff");
const Client = require("../src/models/Client");
const SalaryTransaction = require("../src/models/SalaryTransaction");
const slugUtil = require("../src/utils/slug.util");

const DRY_RUN = process.argv.includes("--dry-run");

// --slug id=slug juftliklari
const manualSlugs = new Map();
process.argv.forEach((arg, i) => {
  if (arg !== "--slug") return;
  const [id, slug] = String(process.argv[i + 1] || "").split("=");
  if (id && slug) manualSlugs.set(id.trim(), slug.trim().toLowerCase());
});

const log = (...args) => console.log(DRY_RUN ? "[dry-run]" : "", ...args);

const migrateStaff = async () => {
  const staffs = await Staff.find({
    $or: [{ centers: { $exists: false } }, { centers: { $size: 0 } }, { salaryValues: { $exists: false } }, { salaryValues: { $size: 0 } }],
  })
    .select("center centers salaryValue salaryValues")
    .lean();

  const ops = [];
  for (const s of staffs) {
    const set = {};
    if (!s.centers?.length) set.centers = [s.center];
    if (!s.salaryValues?.length) set.salaryValues = [{ center: s.center, value: s.salaryValue ?? null }];
    if (Object.keys(set).length) ops.push({ updateOne: { filter: { _id: s._id }, update: { $set: set } } });
  }
  // Asosiy filial `centers` ichida bo'lmagan hujjatlar (qo'lda tahrirlangan bo'lsa).
  const broken = await Staff.find({ $expr: { $not: { $in: ["$center", { $ifNull: ["$centers", []] }] } } })
    .select("center centers")
    .lean();
  for (const s of broken) {
    if (!s.centers?.length) continue; // yuqorida to'ldiriladi
    ops.push({ updateOne: { filter: { _id: s._id }, update: { $addToSet: { centers: s.center } } } });
  }

  log(`Staff: ${ops.length} ta hujjat yangilanadi`);
  if (!DRY_RUN && ops.length) await Staff.bulkWrite(ops, { ordered: false });
};

const migrateSalaryTx = async () => {
  const missing = await SalaryTransaction.find({ $or: [{ center: { $exists: false } }, { center: null }] })
    .select("staff")
    .lean();
  if (!missing.length) return log("SalaryTransaction: center to'liq — o'zgarish yo'q");
  const staffMap = new Map(
    (await Staff.find({ _id: { $in: missing.map((t) => t.staff) } }).select("center").lean()).map((s) => [String(s._id), s.center]),
  );
  const ops = missing
    .filter((t) => staffMap.get(String(t.staff)))
    .map((t) => ({ updateOne: { filter: { _id: t._id }, update: { $set: { center: staffMap.get(String(t.staff)) } } } }));
  log(`SalaryTransaction: ${ops.length}/${missing.length} ta hujjatga center qo'yiladi`);
  if (!DRY_RUN && ops.length) await SalaryTransaction.bulkWrite(ops, { ordered: false });
};

const migrateStaffIndexes = async () => {
  // Mijoz ichida takrorlangan aktiv loginlar bo'lsa yangi unique indeks yaratilmaydi.
  const dups = await Staff.aggregate([
    { $match: { isDeleted: false } },
    { $group: { _id: { client: "$client", login: "$login" }, count: { $sum: 1 }, ids: { $push: "$_id" } } },
    { $match: { count: { $gt: 1 } } },
  ]);
  if (dups.length) {
    console.error("XATO: mijoz ichida takrorlangan loginlar bor — avval qo'lda tuzating:");
    dups.forEach((d) => console.error(`  client=${d._id.client} login=${d._id.login} ids=${d.ids.join(",")}`));
    throw new Error("duplicate logins");
  }

  const indexes = await Staff.collection.indexes();
  const legacy = indexes.find((i) => i.name === "login_1");
  if (legacy) {
    log("Staff: eski global `login_1` indeksi o'chiriladi");
    if (!DRY_RUN) await Staff.collection.dropIndex("login_1");
  } else {
    log("Staff: `login_1` indeksi yo'q — o'tkazib yuborildi");
  }
  if (!DRY_RUN) {
    await Staff.createIndexes();
    log("Staff: yangi indekslar yaratildi ({client, login}, {client, centers, ...})");
  }
};

const migrateClientSlugs = async () => {
  const clients = await Client.find({ isDeleted: false }).select("name slug").sort({ createdAt: 1 });
  const taken = new Set(clients.map((c) => c.slug).filter(Boolean));
  const report = [];

  for (const client of clients) {
    if (client.slug) {
      report.push([String(client._id), client.name, client.slug, "mavjud"]);
      continue;
    }
    let slug = manualSlugs.get(String(client._id));
    if (slug) {
      slug = slugUtil.assertSlug(slug);
      if (taken.has(slug)) throw new Error(`slug band: ${slug}`);
    } else {
      slug = await slugUtil.suggest(client.name, async (s) => taken.has(s));
    }
    taken.add(slug);
    report.push([String(client._id), client.name, slug, "yangi"]);
    if (!DRY_RUN) {
      client.slug = slug;
      await client.save();
    }
  }

  if (!DRY_RUN) await Client.createIndexes();
  console.log("\nMijozlar manzillari:");
  report.forEach(([id, name, slug, state]) => console.log(`  ${state.padEnd(7)} ${id}  ${name}  →  https://${slug}.${env.ROOT_DOMAIN}`));
};

const main = async () => {
  await mongoose.connect(env.MONGO_URI);
  log(`Baza: ${mongoose.connection.name}`);
  await migrateStaff();
  await migrateSalaryTx();
  await migrateStaffIndexes();
  await migrateClientSlugs();
  await mongoose.disconnect();
  console.log(DRY_RUN ? "\nDry-run tugadi — hech narsa yozilmadi." : "\nMigratsiya tugadi.");
  console.log("Eslatma: Redis sessiya keshlari eski shaklda — server qayta ishga tushgach hodimlar ishlayveradi (centersOf fallback).");
};

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
