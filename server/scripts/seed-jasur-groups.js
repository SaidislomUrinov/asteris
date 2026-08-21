/**
 * Test uchun: `jasur` o'qituvchisiga Du·Cho·Ju (mon,wed,fri) kunlari uchun
 * guruhlar yaratadi. Mavjud guruhlariga tegilmaydi.
 *
 * Ishga tushirish: node scripts/seed-jasur-groups.js
 */
require("dotenv").config();
const mongoose = require("mongoose");

const Staff = require("../src/models/Staff");
const Group = require("../src/models/Group");
const Room = require("../src/models/Room");
const Subject = require("../src/models/Subject");
const Counter = require("../src/models/Counter");
const { getNow } = require("../src/utils/date.util");

const DAYS = ["mon", "wed", "fri"];

// Xona nomi + vaqt: har biri bo'sh xonada, o'zaro to'qnashmaydi.
const PLAN = [
  { subject: "Fizika", room: "Xona 2", startTime: "09:00", endTime: "10:30", status: "active" },
  { subject: "Kimyo", room: "Xona 3", startTime: "13:00", endTime: "14:30", status: "active" },
  { subject: "Rus tili", room: "Xona 4", startTime: "16:00", endTime: "17:30", status: "pending" },
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const staff = await Staff.findOne({ login: "jasur", isDeleted: false });
  if (!staff) throw new Error("`jasur` topilmadi");

  const scope = { client: staff.client, center: staff.center, isDeleted: false };
  const rooms = await Room.find(scope);
  const subjects = await Subject.find({ client: staff.client, isDeleted: false });

  for (const item of PLAN) {
    const room = rooms.find((r) => r.name === item.room);
    const subject = subjects.find((s) => s.name === item.subject);
    if (!room || !subject) {
      console.log(`SKIP ${item.subject}/${item.room} — xona yoki fan topilmadi`);
      continue;
    }

    // Xona shu kunlarda shu vaqtda bandmi?
    const clash = await Group.findOne({
      ...scope,
      room: room._id,
      status: { $ne: "finished" },
      days: { $in: DAYS },
      startTime: { $lt: item.endTime },
      endTime: { $gt: item.startTime },
    });
    if (clash) {
      console.log(`SKIP ${item.subject} — ${item.room} band (${clash._id})`);
      continue;
    }

    const group = new Group({
      client: staff.client,
      center: staff.center,
      subject: subject._id,
      teacher: staff._id,
      room: room._id,
      days: DAYS,
      startTime: item.startTime,
      endTime: item.endTime,
      maxStudents: 12,
      status: item.status,
      pendingId: await Counter.next(`group_pending_${staff.client}`),
    });
    if (item.status === "active") {
      group.activeId = await Counter.next(`group_active_${staff.client}`);
      group.activatedAt = getNow();
    }
    await group.save();

    const no = group.status === "pending" ? group.pendingId : group.activeId;
    console.log(
      `OK  ${item.subject} - ${no} | ${item.room} | Du·Cho·Ju ${item.startTime}-${item.endTime} | ${group.status} | ${group._id}`,
    );
  }

  await mongoose.disconnect();
})();
