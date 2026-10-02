// Bir martalik: mavjud `Student.parentPhone` qiymatlarini `+998XXXXXXXXX`
// formatiga keltiradi (Telegram ota-ona oqimi uchun). Idempotent.
//   node scripts/migrate-parent-phone.js
require("dotenv").config();
const mongoose = require("mongoose");
const env = require("../src/configs/env.config");
const Student = require("../src/models/Student");
const { normalizePhone } = require("../src/utils/phone.util");

(async () => {
  await mongoose.connect(env.MONGO_URI);
  const cursor = Student.find({ parentPhone: { $gt: "" } }, { parentPhone: 1 }).lean().cursor();
  let changed = 0, kept = 0, odd = [];
  for await (const s of cursor) {
    const n = normalizePhone(s.parentPhone);
    if (n === s.parentPhone) { kept++; continue; }
    await Student.updateOne({ _id: s._id }, { $set: { parentPhone: n } });
    changed++;
    if (!/^\+998\d{9}$/.test(n)) odd.push(`${s._id} ${JSON.stringify(s.parentPhone)}`);
  }
  await Student.syncIndexes();
  console.log({ changed, kept, unrecognized: odd.length });
  if (odd.length) console.log("Tanib bo'lmagan (qo'lda tekshiring):\n" + odd.join("\n"));
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
