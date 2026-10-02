const CenterHoliday = require("../models/CenterHoliday");
const Center = require("../models/Center");
const Group = require("../models/Group");
const GroupHoliday = require("../models/GroupHoliday");
const groupHolidayService = require("../services/groupHoliday.service");
const moment = require("moment-timezone");
const { currentMonthString, dateStringToUnix, addMonths, formatDay } = require("../utils/date.util");

const TZ = "Asia/Tashkent";
const { JS_DAY_TO_CODE } = require("../utils/lessonDays.util");
const emit = require("../utils/emitter.util");

const assertCenterOwnership = async (clientId, centerId) => {
  const center = await Center.findOne({ _id: centerId, client: clientId, isDeleted: false });
  if (!center) throw new Error("center.notFound");
  return center;
};

const activeGroupsOf = (clientId, centerId) =>
  Group.find({ client: clientId, center: centerId, status: "active", isDeleted: false }).select(
    "days startTime activatedAt",
  );

module.exports = {
  // attendance/lesson/syllabus guardlari uchun umumiy helper.
  isCenterHoliday: async (centerId, date) => {
    const holiday = await CenterHoliday.findOne({ center: centerId, date }).select("_id");
    return !!holiday;
  },

  // attendance.service.js'ning getNonChargeableDates/countLessonDaysInMonth/
  // getMonth funksiyalarini CenterHoliday bilan ham hisoblashga kengaytirish
  // uchun — shu Center'dagi CenterHoliday sanalari (Set<string>) qaytadi.
  getCenterHolidayDates: async (centerId, month = null) => {
    const query = { center: centerId };
    if (month) query.date = { $gte: `${month}-01`, $lte: `${month}-31` };
    const holidays = await CenterHoliday.find(query).select("date note");
    return holidays;
  },

  listForMonth: async (clientId, centerId, month) => {
    await assertCenterOwnership(clientId, centerId);
    const targetMonth = month || currentMonthString();
    if (!/^\d{4}-\d{2}$/.test(targetMonth)) throw new Error("calendar.invalidMonth");

    const [groups, holidays] = await Promise.all([
      activeGroupsOf(clientId, centerId),
      CenterHoliday.find({
        center: centerId,
        date: { $gte: `${targetMonth}-01`, $lte: `${targetMonth}-31` },
      }),
    ]);
    const holidayMap = new Map(holidays.map((h) => [h.date, h]));

    const monthStart = dateStringToUnix(`${targetMonth}-01`);
    const nextMonthStart = addMonths(monthStart, 1);
    const daysInMonth = Math.round((nextMonthStart - monthStart) / 86400);

    const days = [];
    for (let i = 0; i < daysInMonth; i += 1) {
      const dateUnix = monthStart + i * 86400;
      // Sana va hafta kuni Toshkent bo'yicha — `toISOString`/`getUTCDay`
      // UTC'da ishlab, butun oyni bir kunga orqaga surib yuborar edi
      // (Toshkent 00:00 = UTC oldingi kun 19:00).
      const date = formatDay(dateUnix);
      const dayCode = JS_DAY_TO_CODE[moment.unix(dateUnix).tz(TZ).day()];
      const holiday = holidayMap.get(date);

      let lessonCount = 0;
      for (const g of groups) {
        if (!g.days?.includes(dayCode)) continue;
        if (g.activatedAt && g.activatedAt > dateUnix) continue;
        lessonCount += 1;
      }

      days.push({
        date,
        lessonCount,
        cancelledByHoliday: !!holiday,
        holiday: holiday
          ? { note: holiday.note || "", createdBy: holiday.createdBy }
          : null,
      });
    }

    return { days };
  },

  // Center'dagi barcha faol guruhlar uchun GroupHoliday-credit sync qo'llab,
  // CenterHoliday hujjatini (har sana uchun) upsert qiladi. Faqat shu marking
  // orqali YANGI yaratilgan GroupHoliday'lar `syncedGroups`ga yoziladi —
  // guruh darajasida foydalanuvchi qo'lda belgilagan holiday'larga tegilmaydi.
  mark: async (clientId, centerId, createdBy, body) => {
    const center = await assertCenterOwnership(clientId, centerId);
    const dates = Array.isArray(body?.dates) ? body.dates : [];
    if (!dates.length) throw new Error("calendar.datesRequired");
    for (const d of dates) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error("calendar.invalidDate");
    }
    const note = String(body?.note || "").trim().slice(0, 160);

    const groups = await Group.find({
      client: clientId,
      center: centerId,
      status: "active",
      isDeleted: false,
    }).select("_id");

    const marked = [];
    for (const date of dates) {
      const syncedGroups = [];
      for (const group of groups) {
        const existing = await GroupHoliday.findOne({ group: group._id, date });
        if (existing) continue; // guruh darajasida allaqachon belgilangan — tegilmaydi
        await GroupHoliday.create({
          client: clientId,
          center: centerId,
          group: group._id,
          date,
          chargeable: false,
          note,
        });
        await groupHolidayService.syncCreditForDate(clientId, group._id, date, true);
        syncedGroups.push(group._id);
      }

      await CenterHoliday.findOneAndUpdate(
        { center: centerId, date },
        {
          $set: { client: clientId, note, createdBy },
          $addToSet: { syncedGroups: { $each: syncedGroups } },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );
      marked.push(date);
    }

    emit(`center:${centerId}`, "calendar:updated", { centerId, dates: marked });
    return { marked };
  },

  unmark: async (clientId, centerId, date) => {
    await assertCenterOwnership(clientId, centerId);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("calendar.invalidDate");

    const holiday = await CenterHoliday.findOne({ center: centerId, date });
    if (!holiday) return { date };

    for (const groupId of holiday.syncedGroups || []) {
      await GroupHoliday.deleteOne({ group: groupId, date });
      await groupHolidayService.syncCreditForDate(clientId, groupId, date, false);
    }

    await CenterHoliday.deleteOne({ _id: holiday._id });

    emit(`center:${centerId}`, "calendar:updated", { centerId, dates: [date] });
    return { date };
  },
};
