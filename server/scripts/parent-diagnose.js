// Diagnostika: ota-ona WebApp'ida "Bugun" darslari nega ko'rinmayotganini
// shart-bashart ko'rsatadi. Hech narsani o'zgartirmaydi.
// Ishlatish: node scripts/parent-diagnose.js +998XXXXXXXXX   (ota-ona telefoni)
require("dotenv").config();
const mongoose = require("mongoose");
const moment = require("moment-timezone");

(async () => {
  const phone = process.argv[2];
  if (!phone) { console.error("Ota-ona telefoni kerak: +998..."); process.exit(1); }
  await mongoose.connect(process.env.MONGO_URI);
  const Parent = require("../src/models/Parent");
  const Student = require("../src/models/Student");
  const Group = require("../src/models/Group");
  const Center = require("../src/models/Center");
  const Attendance = require("../src/models/Attendance");
  const Grade = require("../src/models/Grade");
  const { JS_DAY_TO_CODE } = require("../src/utils/lessonDays.util");
  const clientService = require("../src/services/client.service");

  const TZ = "Asia/Tashkent";
  const now = moment.tz(TZ);
  const todayCode = JS_DAY_TO_CODE[now.day()];
  console.log(`Server vaqti: ${now.format("YYYY-MM-DD HH:mm")} (${TZ}) → bugun: "${todayCode}" | TZ env: ${process.env.TZ || "-"} | NODE_ENV: ${process.env.NODE_ENV}`);

  const parent = await Parent.findOne({ phone });
  console.log(`\nParent: ${parent ? `${parent.name || "-"} chatId=${parent.telegram?.chatId} userId=${parent.telegram?.userId}` : "TOPILMADI (botga ulanmagan)"}`);
  if (!parent) process.exit(0);

  const students = await Student.find({ isDeleted: false, $or: [{ parentTelegramPhone: phone }, { telegramPhone: phone }] });
  console.log(`O'quvchilar (parentTelegramPhone yoki telegramPhone = ${phone}): ${students.length}`);
  const deleted = await Student.countDocuments({ isDeleted: true, $or: [{ parentTelegramPhone: phone }, { telegramPhone: phone }] });
  if (deleted) console.log(`  ! ${deleted} ta o'quvchi arxivda (isDeleted) — ko'rinmaydi`);

  for (const s of students) {
    console.log(`\n■ ${s.fullName} (${s.phone})`);
    if (!s.groups?.length) { console.log("  ✗ groups[] bo'sh — hech qanday guruhga a'zo emas"); continue; }
    for (const e of s.groups) {
      const g = await Group.findById(e.group).lean();
      const c = await Center.findById(e.center).lean();
      const tag = (ok) => (ok ? "✓" : "✗");
      console.log(`  ▸ Guruh: ${g?.name || e.group}  (a'zolik status=${e.status})`);
      if (!g) { console.log("    ✗ Guruh hujjati topilmadi"); continue; }
      const linkedFlag = c ? await clientService.hasPermission(String(c.client), "parent.notifications") : false;
      const centerEnabled = c?.parentNotifications?.enabled !== false;
      const dayOk = (g.days || []).includes(todayCode);
      console.log(`    ${tag(e.status === "active")} a'zolik faol (status="${e.status}")`);
      console.log(`    ${tag(g.status === "active")} guruh faol (status="${g.status}"${g.status === "pending" ? " — guruh hali AKTIVLASHTIRILMAGAN" : ""})`);
      console.log(`    ${tag(!!c)} markaz topildi: ${c?.name || e.center}`);
      console.log(`    ${tag(linkedFlag)} tarifda "parent.notifications" ruxsati (client=${c?.client})`);
      console.log(`    ${tag(centerEnabled)} markazda ota-ona xabarlari yoqilgan (parentNotifications.enabled=${c?.parentNotifications?.enabled})`);
      console.log(`    ${tag(dayOk)} bugun dars kuni: days=[${(g.days || []).join(",")}] vaqt=${g.startTime || "-"}–${g.endTime || "-"}`);
      const all = e.status === "active" && g.status === "active" && c && linkedFlag && centerEnabled && dayOk;
      console.log(`    → ${all ? "BUGUN RO'YXATIDA KO'RINADI" : "ko'rinmaydi"}`);
      // Davomat/baho — shu oy va jami (ma'lumot umuman bormi?)
      const month = now.format("YYYY-MM");
      const attAll = await Attendance.countDocuments({ group: g._id, "records.student": s._id });
      const attMonth = await Attendance.countDocuments({ group: g._id, "records.student": s._id, date: { $gte: `${month}-01`, $lte: `${month}-31` } });
      const grAll = await Grade.countDocuments({ group: g._id, student: s._id });
      const grMonth = await Grade.countDocuments({ group: g._id, student: s._id, date: { $gte: `${month}-01`, $lte: `${month}-31` } });
      const lastAtt = await Attendance.findOne({ group: g._id }).sort({ date: -1 }).select("date records").lean();
      console.log(`    davomat: shu oy ${attMonth}, jami ${attAll}${lastAtt ? ` (guruhda oxirgi belgilangan sana: ${lastAtt.date}, shu o'quvchi yozuvi: ${lastAtt.records.some((r) => String(r.student) === String(s._id)) ? "bor" : "YO'Q"})` : " (guruhda umuman davomat belgilanmagan)"}`);
      console.log(`    baho: shu oy ${grMonth}, jami ${grAll}${c?.parentNotifications?.showGrades === false ? " — ! markazda ota-onaga baho ko'rsatish O'CHIRILGAN" : ""}`);
    }
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
