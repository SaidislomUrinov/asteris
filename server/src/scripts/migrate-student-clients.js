// O'quvchi MIJOZ (brend) darajasida (docs/API_CONTRACT_student_per_client.md §4).
// Server ishga tushganda AVTOMATIK (connectDB). HECH NARSA O'CHIRILMAYDI:
//
//   - `client` bo'sh har hujjatning to'liq asl nusxasi avval BACKUP kolleksiyasiga
//     yoziladi (bir marta) — bo'lish rejasi ham shu nusxadan tuziladi, shuning uchun
//     jarayon istalgan joyda uzilsa, qayta ishga tushganda davom ettiriladi.
//   - 1 mijoz → faqat `client` qo'yiladi.
//   - 2+ mijoz → asosiy mijoz (birinchi a'zolik) asl hujjatda qoladi; boshqa har
//     mijoz uchun yangi hujjat (deterministik _id — cluster'da ikki nusxa bo'lmaydi),
//     shu mijozdagi bog'liq yozuvlar yangi _id'ga ko'chiriladi, a'zoliklar ko'chadi.
//   - Bir vaqtda faqat BITTA jarayon ishlaydi (Redis qulfi), qolganlari tugashini kutadi.
//
// Qo'lda hisobot (hech narsa yozmaydi): node scripts/migrate-student-clients.js --dry-run
const crypto = require("crypto");
const mongoose = require("mongoose");

const BACKUP = "students_backup_20261016";
const LOCK_KEY = "migration:studentClients";
const LOCK_MS = 15 * 60 * 1000;

// `student` maydoni + `client` maydoni bor kolleksiyalar.
const SIMPLE_REFS = [
  "Grade",
  "CoinWallet",
  "CoinTransaction",
  "ShopOrder",
  "Certificate",
  "StudentBadge",
  "StudentMedal",
  "StudentLead",
];
// Massiv ichida `student` (yozuvlar/natijalar) + hujjatda `client`.
const ARRAY_REFS = [
  { model: "Attendance", path: "records" },
  { model: "Homework", path: "results" },
];

const loadModels = () => {
  for (const name of [...SIMPLE_REFS, "Attendance", "Homework", "ShopLike", "ShopProduct", "AuditLog", "ImportBatch", "Student"]) {
    require(`../models/${name}`);
  }
  return (name) => mongoose.model(name);
};

// Yangi hujjat _id'si asl _id + mijozdan deterministik — ikki worker yoki qayta
// ishga tushirish ikkinchi nusxa yarata olmaydi. Vaqt qismi (birinchi 4 bayt)
// asl hujjatniki — _id bo'yicha saralashda o'quvchi o'z joyida qoladi.
const splitIdOf = (originalId, clientId) =>
  new mongoose.Types.ObjectId(
    String(originalId).slice(0, 8) +
      crypto.createHash("sha1").update(`student-split:${originalId}:${clientId}`).digest("hex").slice(0, 16),
  );

// Mijozlar a'zolik tartibida (birinchisi — asosiy).
const clientsOf = (doc) => {
  const seen = [];
  for (const g of doc.groups || []) {
    const c = g.client ? String(g.client) : null;
    if (c && !seen.includes(c)) seen.push(c);
  }
  return seen;
};

const remapReferences = async (M, clientId, fromId, toId) => {
  const client = new mongoose.Types.ObjectId(clientId);
  for (const name of SIMPLE_REFS) {
    await M(name).collection.updateMany({ client, student: fromId }, { $set: { student: toId } });
  }
  for (const { model, path } of ARRAY_REFS) {
    await M(model).collection.updateMany(
      { client, [`${path}.student`]: fromId },
      { $set: { [`${path}.$[e].student`]: toId } },
      { arrayFilters: [{ "e.student": fromId }] },
    );
  }
  // Like'larda mijoz yo'q — mahsulot orqali.
  const products = await M("ShopProduct").collection.distinct("_id", { client });
  if (products.length) {
    await M("ShopLike").collection.updateMany({ student: fromId, product: { $in: products } }, { $set: { student: toId } });
  }
  // Audit tarixi yangi hujjatga bog'lanadi (o'chirilmaydi).
  await M("AuditLog").collection.updateMany({ client, "entity.id": fromId }, { $set: { "entity.id": toId } });
};

// `doc` — JORIY hujjat (reja shundan), `backupDoc` — birinchi ko'rilgandagi asl
// nusxa: faqat uzilishda asl hujjatdan olinib, hali yangi hujjatga yozilmay
// qolgan a'zoliklarni tiklash uchun. Yangi hujjatdagi a'zoliklar hech qachon
// ustidan yozilmaydi — faqat yetishmaganlari qo'shiladi.
const splitOne = async (M, doc, backupDoc, report, dryRun) => {
  const Students = M("Student").collection;
  const original = backupDoc || doc;
  // Asosiy mijoz — asl nusxadagi birinchi a'zolik (qayta ishga tushganda o'zgarmaydi).
  const clients = [...new Set([...clientsOf(original), ...clientsOf(doc)])];
  const primary = clients[0];
  const now = Math.floor(Date.now() / 1000);
  const byClient = (arr, c) => (arr || []).filter((x) => String(x.client) === c);
  const batchId = doc.importBatch || original.importBatch;
  const batchClient = batchId
    ? String((await M("ImportBatch").collection.findOne({ _id: batchId }, { projection: { client: 1 } }))?.client || "")
    : "";

  for (const c of clients.slice(1)) {
    const newId = splitIdOf(doc._id, c);
    const current = byClient(doc.groups, c);
    report.split.push(`${doc.fullName} (${doc.phone}) → mijoz ${c}: ${(current.length ? current : byClient(original.groups, c)).length} a'zolik`);
    if (dryRun) continue;
    const clientOid = new mongoose.Types.ObjectId(c);
    const pick = (field) => (byClient(doc[field], c).length ? byClient(doc[field], c) : byClient(original[field], c));

    // 1) Yangi hujjat (a'zoliksiz) — mavjud bo'lsa qayta ishlatiladi.
    try {
      await Students.insertOne({
        _id: newId,
        client: clientOid,
        splitFrom: doc._id,
        phone: doc.phone,
        fullName: doc.fullName,
        parentPhone: doc.parentPhone || "",
        telegramSame: doc.telegramSame,
        telegramPhone: doc.telegramPhone || "",
        parentTelegramSame: doc.parentTelegramSame,
        parentTelegramPhone: doc.parentTelegramPhone || "",
        photos: pick("photos"),
        qrToken: null,
        qrTokens: pick("qrTokens"),
        groups: [],
        importBatch: batchClient === c ? batchId : null,
        isDeleted: !!doc.isDeleted,
        deletedAt: doc.deletedAt ?? null,
        createdAt: doc.createdAt ?? now,
        updatedAt: now,
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
    // 2) Shu mijozdagi bog'liq yozuvlar yangi _id'ga.
    await remapReferences(M, c, doc._id, newId);

    // 3) A'zoliklar: avval asl hujjatdan olinadi, so'ng yangisiga qo'shiladi
    //    (to'lov kodlari bir vaqtda ikki hujjatda turmasin).
    const target = await Students.findOne({ _id: newId }, { projection: { groups: 1 } });
    const have = new Set((target?.groups || []).map((g) => String(g._id)));
    // Joriy hujjatdagisi — eng yangi holat; bo'lmasa (uzilishdan keyin) nusxadagi
    // va yangi hujjatda HALI YO'Q a'zoliklar.
    const toAdd = current.length ? current : byClient(original.groups, c).filter((g) => !have.has(String(g._id)));
    await Students.updateOne(
      { _id: doc._id },
      { $pull: { groups: { client: clientOid }, photos: { client: clientOid }, qrTokens: { client: clientOid } } },
    );
    if (toAdd.length) {
      const replaceIds = new Set(toAdd.map((g) => String(g._id)));
      const kept = (target?.groups || []).filter((g) => !(current.length && replaceIds.has(String(g._id))));
      await Students.updateOne({ _id: newId }, { $set: { groups: [...kept, ...toAdd], updatedAt: now } });
    }
  }

  if (dryRun) return;
  // 4) Asl hujjat — eng oxirida (shundan keyin qayta ko'rilmaydi).
  await Students.updateOne(
    { _id: doc._id },
    {
      $set: {
        client: new mongoose.Types.ObjectId(primary),
        ...(batchClient && batchClient !== primary ? { importBatch: null } : {}),
      },
    },
  );
};

const run = async ({ dryRun = false } = {}) => {
  const M = loadModels();
  const Students = M("Student").collection;
  const backup = mongoose.connection.db.collection(BACKUP);
  const report = { single: 0, orphan: 0, split: [] };

  const pending = await Students.find({ $or: [{ client: { $exists: false } }, { client: null }] }).toArray();
  for (const doc of pending) {
    // Asl nusxa — bir marta (birinchi ko'rilgan holat saqlanadi).
    if (!dryRun) await backup.updateOne({ _id: doc._id }, { $setOnInsert: doc }, { upsert: true });
    const backupDoc = dryRun ? null : await backup.findOne({ _id: doc._id });
    const clients = [...new Set([...clientsOf(backupDoc || doc), ...clientsOf(doc)])];
    if (!clients.length) {
      report.orphan += 1;
      continue;
    }
    if (clients.length === 1) {
      report.single += 1;
      if (!dryRun) await Students.updateOne({ _id: doc._id }, { $set: { client: new mongoose.Types.ObjectId(clients[0]) } });
      continue;
    }
    await splitOne(M, doc, backupDoc, report, dryRun);
  }
  return report;
};

// Redis qulfi bilan — cluster'da bitta worker bajaradi, qolganlari kutadi.
const migrateStudentClients = async () => {
  const redis = require("../configs/redis.config");
  const token = `${process.pid}:${Date.now()}`;
  const started = Date.now();
  for (;;) {
    const ok = await redis.set(LOCK_KEY, token, "PX", LOCK_MS, "NX");
    if (ok === "OK") break;
    // Qulf egasi qulagan bo'lsa (TTL tugaguncha) — kutishni to'xtatib bajaramiz
    // (migratsiya idempotent, nusxadan davom etadi).
    if (Date.now() - started > LOCK_MS) {
      console.warn("O'quvchi migratsiyasi: qulf kutish muddati tugadi, davom etilmoqda");
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  try {
    const report = await run();
    if (report.single || report.split.length) {
      console.log(
        `O'quvchilar mijoz bo'yicha: ${report.single} ta bitta mijozli, ${report.split.length} ta bo'linish` +
          (report.orphan ? `, ${report.orphan} ta guruhsiz (tegilmadi)` : ""),
      );
      report.split.forEach((line) => console.log(`  bo'lindi: ${line}`));
    }
  } finally {
    if ((await redis.get(LOCK_KEY)) === token) await redis.del(LOCK_KEY);
  }
};

module.exports = migrateStudentClients;
module.exports.run = run;
module.exports.BACKUP = BACKUP;
