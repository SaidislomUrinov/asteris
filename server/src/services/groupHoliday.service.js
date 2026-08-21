const GroupHoliday = require("../models/GroupHoliday");
const Group = require("../models/Group");
const Student = require("../models/Student");
const { currentMonthString } = require("../utils/date.util");

const DTO = (h) => ({ date: h.date, chargeable: h.chargeable, note: h.note || "" });

const assertGroupOwnership = async (clientId, groupId) => {
  const group = await Group.findOne({ _id: groupId, client: clientId, isDeleted: false });
  if (!group) throw new Error("group.notFound");
  return group;
};

// "To'lov olinmasin" (chargeable:false) belgilanganda — guruhdagi har bir
// FAOL o'quvchining shu guruh entry'siga xuddi davomat krediti kabi (bitta
// sana belgisi, summasiz) credit qo'shiladi. computeBilling (student.
// service.js) buni ko'rib, shu sikl narxini AYNAN shu kunlik narxga
// kamaytiradi — ortiqcha to'lov esa (paidAmount butun tarix bo'yicha
// yig'ilgani uchun) avtomatik keyingi sikl(lar)ning qarzini kamaytiradi.
// Belgi olib tashlansa yoki qayta "to'lov olinsin"ga o'zgarsa — credit ham
// olib tashlanadi, hisob avtomatik asl holiga qaytadi (hammasi jonli
// qayta hisoblanadi, alohida "keyingi oyga o'tkazilgan summa" saqlanmaydi).
const syncCreditForDate = async (clientId, groupId, date, shouldCredit) => {
  const students = await Student.find({
    isDeleted: false,
    groups: { $elemMatch: { group: groupId, client: clientId, status: "active" } },
  });
  for (const student of students) {
    const entry = student.groups.find(
      (g) => String(g.group) === String(groupId) && String(g.client) === String(clientId),
    );
    if (!entry) continue;
    const already = (entry.credits || []).some((c) => c.date === date);
    if (shouldCredit === already) continue;
    entry.credits = (entry.credits || []).filter((c) => c.date !== date);
    if (shouldCredit) entry.credits.push({ date });
    await student.save();
  }
};

module.exports = {
  // LessonCalendar oy ko'rinishida qaysi sanalar dam olish kuni deb
  // belgilanganini ko'rsatish uchun.
  listForMonth: async (clientId, groupId, month) => {
    await assertGroupOwnership(clientId, groupId);
    const targetMonth = month || currentMonthString();
    const holidays = await GroupHoliday.find({
      group: groupId,
      date: { $gte: `${targetMonth}-01`, $lte: `${targetMonth}-31` },
    });
    return holidays.map(DTO);
  },

  // Billing hisob-kitobi uchun — shu guruhning BARCHA "to'lovsiz" (chargeable:
  // false) dam olish kunlari, Set(sana) ko'rinishida. Ownership tekshiruvi
  // shart emas — chaqiruvchi (student.service.js) allaqachon guruhni
  // tekshirgan bo'ladi (ichki, trusted chaqiruv).
  getNonChargeableDates: async (groupId) => {
    const holidays = await GroupHoliday.find({ group: groupId, chargeable: false }).select("date");
    return new Set(holidays.map((h) => h.date));
  },

  mark: async (clientId, groupId, body) => {
    const group = await assertGroupOwnership(clientId, groupId);
    const { date, chargeable, note } = body;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("group.invalidDate");

    const holiday = await GroupHoliday.findOneAndUpdate(
      { group: groupId, date },
      {
        $set: {
          client: clientId,
          center: group.center,
          chargeable: !!chargeable,
          note: String(note || "").trim().slice(0, 160),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    await syncCreditForDate(clientId, groupId, date, !chargeable);
    return DTO(holiday);
  },

  unmark: async (clientId, groupId, date) => {
    await assertGroupOwnership(clientId, groupId);
    await GroupHoliday.deleteOne({ group: groupId, date });
    await syncCreditForDate(clientId, groupId, date, false);
    return { date };
  },
};
