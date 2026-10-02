// Deploy'da MAJBURIY (API_CONTRACT_telegram_phone.md §6): alohida Telegram
// raqami maydonlarini to'ldiradi — aks holda eski o'quvchilar botda topilmaydi
// (bot endi FAQAT `telegramPhone` / `parentTelegramPhone` bo'yicha qidiradi).
//
//   Student / StudentLead (`telegramSame` maydoni YO'Q hujjatlar):
//     telegramSame: true,       telegramPhone: normalizeTelegramPhone(phone) || ""
//     parentTelegramSame: true, parentTelegramPhone: normalizeTelegramPhone(parentPhone) || ""
//   Parent.phone — normalizeTelegramPhone bilan qayta normalizatsiya (xorijiy
//     raqamlar `+` oladi).
//
// Idempotent: faqat maydoni yo'q hujjatlarga tegadi. `--force` — BARCHA
// hujjatlarni "bir xil" holatga qaytaradi (qo'lda kiritilgan Telegram raqamlari
// o'chadi!). `--dry-run` — hech narsa yozilmaydi, faqat hisobot.
//
//   cd server && node scripts/migrate-telegram-same.js --dry-run
//   cd server && node scripts/migrate-telegram-same.js
require("dotenv").config();
const mongoose = require("mongoose");
const env = require("../src/configs/env.config");
const Student = require("../src/models/Student");
const StudentLead = require("../src/models/StudentLead");
const Parent = require("../src/models/Parent");
const { normalizeTelegramPhone } = require("../src/utils/phone.util");

const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");
const BATCH = 1000;

const unrecognized = [];

const tg = (model, id, field, raw) => {
  const n = normalizeTelegramPhone(raw);
  if (n === null) {
    unrecognized.push(`${model} ${id} ${field}=${JSON.stringify(raw)}`);
    return "";
  }
  return n;
};

// Bitta kolleksiya uchun: cursor → $set operatsiyalari → bulkWrite (1000 tadan).
const migrateSameFields = async (Model, name) => {
  const filter = FORCE ? {} : { telegramSame: { $exists: false } };
  const cursor = Model.find(filter, {
    phone: 1,
    parentPhone: 1,
    telegramSame: 1,
    telegramPhone: 1,
    parentTelegramSame: 1,
    parentTelegramPhone: 1,
  })
    .lean()
    .cursor();

  let ops = [];
  let changed = 0;
  let scanned = 0;
  const flush = async () => {
    if (!ops.length) return;
    if (!DRY_RUN) await Model.bulkWrite(ops, { ordered: false });
    ops = [];
  };

  for await (const doc of cursor) {
    scanned += 1;
    const next = {
      telegramSame: true,
      telegramPhone: tg(name, doc._id, "phone", doc.phone),
      parentTelegramSame: true,
      parentTelegramPhone: tg(name, doc._id, "parentPhone", doc.parentPhone),
    };
    // --force'da allaqachon aynan shu holatdagi hujjatlar qayta yozilmaydi.
    const same = Object.keys(next).every((k) => doc[k] === next[k]);
    if (same) continue;
    changed += 1;
    // Native $set (updatedAt tegilmaydi — ma'lumot o'zgarmadi, faqat hosila maydon).
    ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: next } } });
    if (ops.length >= BATCH) await flush();
  }
  await flush();
  return { scanned, changed };
};

const migrateParents = async () => {
  const cursor = Parent.find({}, { phone: 1 }).lean().cursor();
  let ops = [];
  let changed = 0;
  let scanned = 0;
  const flush = async () => {
    if (!ops.length) return;
    // Parent.collection — setter'ni chetlab, aynan hisoblangan qiymat yoziladi.
    if (!DRY_RUN) await Parent.collection.bulkWrite(ops, { ordered: false });
    ops = [];
  };
  for await (const p of cursor) {
    scanned += 1;
    const n = normalizeTelegramPhone(p.phone);
    if (n === null) {
      unrecognized.push(`Parent ${p._id} phone=${JSON.stringify(p.phone)}`);
      continue;
    }
    if (!n || n === p.phone) continue;
    changed += 1;
    ops.push({ updateOne: { filter: { _id: p._id }, update: { $set: { phone: n } } } });
    if (ops.length >= BATCH) await flush();
  }
  await flush();
  return { scanned, changed };
};

(async () => {
  // Dry-run'da Mongoose avtomatik indeks yaratmasin — bazaga hech narsa tegmasin.
  if (DRY_RUN) mongoose.set("autoIndex", false);
  await mongoose.connect(env.MONGO_URI);
  console.log(`Rejim: ${DRY_RUN ? "DRY-RUN (hech narsa yozilmaydi)" : "YOZISH"}${FORCE ? " + FORCE" : ""}`);

  const students = await migrateSameFields(Student, "Student");
  const leads = await migrateSameFields(StudentLead, "StudentLead");
  const parents = await migrateParents();

  if (!DRY_RUN) {
    await Student.syncIndexes();
    await StudentLead.syncIndexes();
    await Parent.syncIndexes();
  }

  console.log({
    students: students.changed,
    leads: leads.changed,
    parents: parents.changed,
    unrecognized: unrecognized.length,
    scanned: { students: students.scanned, leads: leads.scanned, parents: parents.scanned },
  });
  if (unrecognized.length) {
    console.log("Tanib bo'lmagan raqamlar (Telegram raqami bo'sh qoldi — qo'lda tekshiring):");
    console.log(unrecognized.join("\n"));
  }
  await mongoose.disconnect();
})().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
