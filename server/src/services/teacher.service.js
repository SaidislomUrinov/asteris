const Group = require("../models/Group");
const Room = require("../models/Room");
const Subject = require("../models/Subject");
const Student = require("../models/Student");
const salaryService = require("./salary.service");
const groupService = require("./group.service");
const { todayDayCode, currentMonthString } = require("../utils/date.util");
const moment = require("moment-timezone");

// O'qituvchi paneli uchun yagona dashboard so'rovi — guruhlari, xonalari,
// o'quvchilar soni, bugungi darslari va shu oygi oyligi bitta javobda
// (docs/teacher-panel.md). Har blok uchun alohida so'rov qilinsa mobil
// internetda sahifa sekin ochilardi.
module.exports = {
  // `scopeField` — "teacher" yoki "assistant" (yordamchi o'qituvchi ham
  // shu dashboardni ko'radi, faqat o'ziga biriktirilgan guruhlar bo'yicha).
  dashboard: async (clientId, staffId, { month = "", scopeField = "teacher" } = {}) => {
    const targetMonth = month || currentMonthString();

    const groups = await Group.find({
      client: clientId,
      [scopeField]: staffId,
      isDeleted: false,
      status: { $in: ["pending", "active"] },
    }).sort({ createdAt: -1 });

    const groupIds = groups.map((g) => g._id);
    const subjectIds = [...new Set(groups.map((g) => String(g.subject)))];
    const roomIds = [...new Set(groups.filter((g) => g.room).map((g) => String(g.room)))];

    const [subjects, rooms, counts, salary] = await Promise.all([
      Subject.find({ _id: { $in: subjectIds } }).select("name"),
      Room.find({ _id: { $in: roomIds } }).select("name capacity"),
      groupIds.length
        ? Student.aggregate([
            { $match: { isDeleted: false, "groups.group": { $in: groupIds } } },
            { $unwind: "$groups" },
            { $match: { "groups.group": { $in: groupIds }, "groups.status": "active" } },
            { $group: { _id: "$groups.group", students: { $addToSet: "$_id" } } },
          ])
        : [],
      salaryService.detail(clientId, staffId, { month: targetMonth }).catch(() => null),
    ]);

    const subjectMap = Object.fromEntries(subjects.map((s) => [String(s._id), s.name]));
    const roomMap = Object.fromEntries(rooms.map((r) => [String(r._id), r]));
    const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c.students.length]));

    // Umumiy o'quvchilar soni — bir o'quvchi bir nechta guruhda bo'lsa
    // BIR MARTA sanaladi (shuning uchun `$addToSet` bilan yig'ilgan).
    const uniqueStudents = new Set();
    for (const c of counts) for (const id of c.students) uniqueStudents.add(String(id));

    const dayCode = todayDayCode();
    const dto = groups.map((g) => ({
      _id: String(g._id),
      label: `${subjectMap[String(g.subject)] || "?"} - ${g.status === "pending" ? g.pendingId : g.activeId}`,
      subject: subjectMap[String(g.subject)] || "",
      status: g.status,
      days: g.days || [],
      startTime: g.startTime || "",
      endTime: g.endTime || "",
      room: g.room ? { _id: String(g.room), name: roomMap[String(g.room)]?.name || "" } : null,
      studentsCount: countMap[String(g._id)] || 0,
      maxStudents: g.maxStudents ?? null,
      isToday: g.status === "active" && (g.days || []).includes(dayCode),
    }));

    return {
      month: targetMonth,
      stats: {
        groups: dto.filter((g) => g.status === "active").length,
        pendingGroups: dto.filter((g) => g.status === "pending").length,
        rooms: rooms.length,
        students: uniqueStudents.size,
        todayLessons: dto.filter((g) => g.isToday).length,
      },
      groups: dto,
      // Bugungi darslar — vaqt bo'yicha tartiblangan (o'qituvchi kun
      // tartibini shu ro'yxatdan o'qiydi).
      todayLessons: dto
        .filter((g) => g.isToday)
        .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || "")),
      rooms: rooms.map((r) => ({
        _id: String(r._id),
        name: r.name,
        capacity: r.capacity ?? null,
        groups: dto.filter((g) => g.room?._id === String(r._id)).length,
      })),
      salary,
    };
  },

  // Hozir davom etayotgan dars (API_CONTRACT.md "Dars" bo'limi) — teacher/
  // assistant o'zining faol guruhlari orasidan `status==="active" &&
  // days.includes(bugun) && startTime<=hozir<=endTime` shartiga mos
  // birinchisini (bir nechtasi mos kelsa startTime bo'yicha eng yaqinini)
  // topadi. Topilmasa `null`.
  currentLesson: async (clientId, staffId, scopeField = "teacher") => {
    const dayCode = todayDayCode();
    const nowHHmm = moment.tz("Asia/Tashkent").format("HH:mm");

    const groups = await Group.find({
      client: clientId,
      [scopeField]: staffId,
      status: "active",
      isDeleted: false,
      days: dayCode,
    }).sort({ startTime: 1 });

    const current = groups.find((g) => g.startTime <= nowHHmm && nowHHmm <= g.endTime);
    if (!current) return null;

    const group = await groupService.getOne(clientId, current._id);
    return { group, isLive: true };
  },
};
