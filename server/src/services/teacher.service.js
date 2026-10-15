const Group = require("../models/Group");
const Room = require("../models/Room");
const Subject = require("../models/Subject");
const Student = require("../models/Student");
const salaryService = require("./salary.service");
const groupService = require("./group.service");
const calendarService = require("./calendar.service");
const { todayDayCode, currentMonthString, todayString } = require("../utils/date.util");
const moment = require("moment-timezone");

// O'qituvchi paneli uchun yagona dashboard so'rovi — guruhlari, xonalari,
// o'quvchilar soni, bugungi darslari va shu oygi oyligi bitta javobda
// (docs/teacher-panel.md). Har blok uchun alohida so'rov qilinsa mobil
// internetda sahifa sekin ochilardi.
module.exports = {
  // `scopeField` — "teacher" yoki "assistant" (yordamchi o'qituvchi ham
  // shu dashboardni ko'radi, faqat o'ziga biriktirilgan guruhlar bo'yicha).
  // `centerId` — faol filial (ko'p filialli o'qituvchi: guruhlar va oylik
  // faqat shu filialniki, API_CONTRACT_multi_center.md §0.5).
  dashboard: async (clientId, staffId, { month = "", scopeField = "teacher", centerId = null } = {}) => {
    const targetMonth = month || currentMonthString();

    const groups = await Group.find({
      client: clientId,
      ...(centerId ? { center: centerId } : {}),
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
      salaryService.detail(clientId, staffId, { month: targetMonth }, centerId).catch(() => null),
    ]);

    const subjectMap = Object.fromEntries(subjects.map((s) => [String(s._id), s.name]));
    const roomMap = Object.fromEntries(rooms.map((r) => [String(r._id), r]));
    const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c.students.length]));

    // Umumiy o'quvchilar soni — bir o'quvchi bir nechta guruhda bo'lsa
    // BIR MARTA sanaladi (shuning uchun `$addToSet` bilan yig'ilgan).
    const uniqueStudents = new Set();
    for (const c of counts) for (const id of c.students) uniqueStudents.add(String(id));

    // Individual guruhlar (API_CONTRACT_individual_students.md) — sarlavha
    // o'rniga o'quvchi ismi kerak; "Mening guruhlarim" va guruhlar sonidan
    // chiqariladi, lekin "Bugungi darslar"da qoladi (dars baribir o'tiladi).
    const individualStudentIds = counts
      .filter((c) => groups.some((g) => g.kind === "individual" && String(g._id) === String(c._id)))
      .map((c) => c.students[0]);
    const individualStudents = individualStudentIds.length
      ? await Student.find({ _id: { $in: individualStudentIds } }).select("fullName")
      : [];
    const studentNameMap = Object.fromEntries(individualStudents.map((s) => [String(s._id), s.fullName]));
    const individualNameOf = (g) => {
      const c = counts.find((x) => String(x._id) === String(g._id));
      return c ? studentNameMap[String(c.students[0])] || "" : "";
    };

    const dayCode = todayDayCode();
    const dto = groups.map((g) => ({
      _id: String(g._id),
      label: `${subjectMap[String(g.subject)] || "?"} - ${g.status === "pending" ? g.pendingId : g.activeId}`,
      isIndividual: g.kind === "individual",
      studentName: g.kind === "individual" ? individualNameOf(g) : null,
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

    const regular = dto.filter((g) => !g.isIndividual);

    return {
      month: targetMonth,
      stats: {
        groups: regular.filter((g) => g.status === "active").length,
        pendingGroups: regular.filter((g) => g.status === "pending").length,
        individuals: dto.length - regular.length,
        rooms: rooms.length,
        students: uniqueStudents.size,
        todayLessons: dto.filter((g) => g.isToday).length,
      },
      groups: regular,
      // Bugungi darslar — vaqt bo'yicha tartiblangan (o'qituvchi kun
      // tartibini shu ro'yxatdan o'qiydi).
      todayLessons: dto
        .filter((g) => g.isToday)
        .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || "")),
      rooms: rooms.map((r) => ({
        _id: String(r._id),
        name: r.name,
        capacity: r.capacity ?? null,
        groups: regular.filter((g) => g.room?._id === String(r._id)).length,
      })),
      salary,
    };
  },

  // Hozir davom etayotgan dars (API_CONTRACT.md "Dars" bo'limi) — teacher/
  // assistant o'zining faol guruhlari orasidan `status==="active" &&
  // days.includes(bugun) && startTime<=hozir<=endTime` shartiga mos
  // birinchisini (bir nechtasi mos kelsa startTime bo'yicha eng yaqinini)
  // topadi. Topilmasa `null`.
  currentLesson: async (clientId, staffId, scopeField = "teacher", centerId = null) => {
    const dayCode = todayDayCode();
    const nowHHmm = moment.tz("Asia/Tashkent").format("HH:mm");

    const groups = await Group.find({
      client: clientId,
      ...(centerId ? { center: centerId } : {}),
      [scopeField]: staffId,
      status: "active",
      isDeleted: false,
      days: dayCode,
    }).sort({ startTime: 1 });

    const current = groups.find((g) => g.startTime <= nowHHmm && nowHHmm <= g.endTime);
    if (!current) return null;

    // Markaz darajasida bugun dam olish kuni deb belgilangan bo'lsa — Dars
    // ochilmaydi (API_CONTRACT.md "Kalendar").
    if (await calendarService.isCenterHoliday(current.center, todayString())) return null;

    // O'qituvchi/yordamchi — individual foiz (moliyaviy) yashiriladi.
    const group = await groupService.getOne(clientId, current._id, true);
    return { group, isLive: true };
  },
};
