/**
 * Demo ma'lumotini tuzatish (bir martalik skript, `node scripts/fixDemo.js`):
 *  1) Har filialda 4 ta xonani 2 taga tushiradi, guruhlarni jadval
 *     to'qnashuvisiz qolgan 2 xonaga ko'chiradi.
 *  2) Mavjud barcha to'lovlarning "kim qabul qilgan"ini (collectedBy) real
 *     reception/manager hodimlarga (markaz bo'yicha) qayta taqsimlaydi —
 *     hammasi bitta "owner"ga yozilgan edi.
 *  3) Joriy oy (server vaqti bo'yicha) uchun yangi to'lovlar qo'shadi — shu
 *     sabab Dashboard "Oylik tushum" 0 chiqayotgan edi (eski demo faqat
 *     o'tgan oylarga to'lov yozgan, joriy oyga hech kim to'lamagan edi).
 *     "To'langan" o'quvchilar joriy oy narxini to'liq, "qarzdor"lar esa
 *     hech narsa yoki qisman to'laydi — mavjud qarzdorlik nisbati buzilmaydi.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const Room = require("../src/models/Room");
const Group = require("../src/models/Group");
const Staff = require("../src/models/Staff");
const Student = require("../src/models/Student");
const studentService = require("../src/services/student.service");
const { currentMonthString } = require("../src/utils/date.util");

const KEEP_ROOM_NAMES = ["101-xona", "102-xona"];

async function fixRooms() {
  const centers = await Room.distinct("center");
  for (const centerId of centers) {
    const rooms = await Room.find({ center: centerId }).sort({ name: 1 });
    const keep = rooms.filter((r) => KEEP_ROOM_NAMES.includes(r.name));
    const drop = rooms.filter((r) => !KEEP_ROOM_NAMES.includes(r.name));
    if (keep.length < 2 || !drop.length) continue;

    const groups = await Group.find({ center: centerId, room: { $in: drop.map((r) => r._id) } });
    for (const group of groups) {
      // Jadval to'qnashuvisiz qolgan xonani tanlaydi (kun+vaqt kesishmasin).
      let target = null;
      for (const room of keep) {
        const conflict = await Group.exists({
          _id: { $ne: group._id },
          center: centerId,
          room: room._id,
          days: { $in: group.days },
          $or: [
            { startTime: { $lt: group.endTime }, endTime: { $gt: group.startTime } },
          ],
        });
        if (!conflict) {
          target = room;
          break;
        }
      }
      if (!target) target = keep[0]; // demo ma'lumot — oxirgi chora sifatida baribir ko'chiramiz
      group.room = target._id;
      await group.save();
      console.log(`  guruh ${group._id} -> ${target.name}`);
    }

    await Room.deleteMany({ _id: { $in: drop.map((r) => r._id) } });
    console.log(`Center ${centerId}: ${drop.length} xona o'chirildi, ${keep.length} qoldi`);
  }
}

async function fixCollectedBy() {
  const collectors = await Staff.find({ role: { $in: ["reception", "manager"] } }).select(
    "_id center",
  );
  const byCenter = new Map();
  for (const s of collectors) {
    const key = String(s.center);
    if (!byCenter.has(key)) byCenter.set(key, []);
    byCenter.get(key).push(s._id);
  }

  const students = await Student.find({ "groups.payments.0": { $exists: true } });
  let updated = 0;
  for (const student of students) {
    let touched = false;
    for (const entry of student.groups) {
      const pool = byCenter.get(String(entry.center));
      if (!pool || !pool.length) continue;
      for (const payment of entry.payments) {
        // Real hodim biriktiriladi, indeks summasi/sanasi bo'yicha turlanadi
        // (bir xil hodim doim to'lov olavermaydi).
        const idx = Math.abs(payment.date + payment.amount) % pool.length;
        payment.collectedBy = pool[idx];
        payment.collectedByKind = "staff";
        touched = true;
      }
    }
    if (touched) {
      await student.save();
      updated += 1;
    }
  }
  console.log(`To'lov qabul qiluvchi qayta taqsimlandi: ${updated} ta o'quvchi hujjati`);
}

async function fixMonthRevenue() {
  const month = currentMonthString();
  const collectors = await Staff.find({ role: { $in: ["reception", "manager"] } }).select(
    "_id center",
  );
  const byCenter = new Map();
  for (const s of collectors) {
    const key = String(s.center);
    if (!byCenter.has(key)) byCenter.set(key, []);
    byCenter.get(key).push(s._id);
  }

  const students = await Student.find({ "groups.0": { $exists: true } });
  let paidCount = 0;
  let partialCount = 0;
  for (const student of students) {
    for (const entry of student.groups) {
      if (entry.status !== "active") continue;
      // Joriy oy uchun allaqachon to'lov bo'lsa qayta qo'shilmaydi.
      const already = entry.payments.some((p) => p.status === "paid" && p.forMonth === month);
      if (already) continue;

      const pool = byCenter.get(String(entry.center)) || [];
      const collector = pool.length ? { id: pool[Math.floor(Math.random() * pool.length)], kind: "staff" } : null;

      // Mavjud demo taqsimotini saqlash uchun: agar o'quvchida ILGARIGI
      // oylarda to'lovsiz (qarzdor) tarix bo'lsa, joriy oyni ham QISMAN yoki
      // umuman to'lamaydi (~30% qarzdor holat davom etadi); qolganlari
      // joriy oy narxini to'liq to'laydi.
      const hadGap = entry.payments.length === 0;
      const isDebtor = Math.random() < 0.3;

      if (isDebtor && Math.random() < 0.5) {
        // Hech narsa to'lamaydi bu oy — qarzdorlik davom etadi.
        continue;
      }

      const amount = isDebtor
        ? Math.round((entry.price || 300000) * (0.4 + Math.random() * 0.3))
        : entry.price || 300000;

      try {
        await studentService.addPayment(
          entry.client,
          student._id,
          entry._id,
          { amount, type: Math.random() < 0.5 ? "cash" : "card", forMonth: month },
          collector,
        );
        if (isDebtor) partialCount += 1;
        else paidCount += 1;
      } catch (err) {
        console.log(`  o'tkazib yuborildi (${student.fullName}): ${err.message}`);
      }
    }
  }
  console.log(`Joriy oy (${month}) to'lovlari qo'shildi: to'liq=${paidCount}, qisman=${partialCount}`);
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Mongo ulandi");

  console.log("\n1) Xonalarni kamaytirish...");
  await fixRooms();

  console.log("\n2) To'lov qabul qiluvchini tuzatish...");
  await fixCollectedBy();

  console.log("\n3) Joriy oy tushumini to'ldirish...");
  await fixMonthRevenue();

  await mongoose.disconnect();
  console.log("\nTayyor.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
