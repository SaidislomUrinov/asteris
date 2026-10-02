const Attendance = require("../models/Attendance");
const Grade = require("../models/Grade");
const { formatDay } = require("./date.util");

// Guruhdan guruhga o'tkazilgan o'quvchining OLDINGI guruh(lar)dagi davomat
// va baholarini yangi guruh ko'rinishiga qo'shish (API_CONTRACT_student_transfer.md §1, §4).
// Ma'lumot ko'chirilmaydi — manba guruhda o'z sanasi bilan qoladi, bu yerda
// faqat `[from, until]` oynasi ichidagi yozuvlar o'qiladi.

// students: `groups` maydoni yuklangan Student hujjatlari.
// → Map<studentId, [{ group, from: "YYYY-MM-DD", until: "YYYY-MM-DD" }]>
const sourceWindowsOf = (students, groupId) => {
  const map = new Map();
  for (const s of students) {
    const windows = (s.groups || [])
      .filter((g) => String(g.group) === String(groupId))
      .flatMap((g) => g.transferredFrom || [])
      .map((src) => ({ group: String(src.group), from: formatDay(src.from || 0), until: formatDay(src.until) }));
    if (windows.length) map.set(String(s._id), windows);
  }
  return map;
};

const inWindow = (windows, group, date) =>
  windows.some((w) => w.group === group && date >= w.from && date <= w.until);

// Model'dan manba yozuvlarini bitta so'rov bilan tortadi va har o'quvchi
// uchun `date → yozuv` ko'rinishiga keltiradi.
const collect = async (windowsMap, dateFilter, fetchRows) => {
  const result = new Map();
  if (!windowsMap.size) return result;
  const studentIds = [...windowsMap.keys()];
  const groupIds = [...new Set([...windowsMap.values()].flat().map((w) => w.group))];
  const rows = await fetchRows({ groupIds, studentIds, dateFilter });
  for (const { studentId, group, date, value } of rows) {
    const windows = windowsMap.get(studentId);
    if (!windows || !inWindow(windows, group, date)) continue;
    if (!result.has(studentId)) result.set(studentId, new Map());
    result.get(studentId).set(date, { ...value, transferred: true, fromGroup: group });
  }
  return result;
};

// → Map<studentId, Map<date, { status, late, reason, transferred, fromGroup }>>
const transferredAttendance = (windowsMap, dateFilter = null) =>
  collect(windowsMap, dateFilter, async ({ groupIds, studentIds, dateFilter: df }) => {
    const sessions = await Attendance.find({
      group: { $in: groupIds },
      "records.student": { $in: studentIds },
      ...(df ? { date: df } : {}),
    }).select("group date records");
    const wanted = new Set(studentIds);
    const rows = [];
    for (const session of sessions) {
      for (const r of session.records) {
        const sid = String(r.student);
        if (!wanted.has(sid)) continue;
        rows.push({
          studentId: sid,
          group: String(session.group),
          date: session.date,
          value: { status: r.status, late: !!r.late, reason: r.reason || "" },
        });
      }
    }
    return rows;
  });

// → Map<studentId, Map<date, { _id, value, note, teacher, transferred, fromGroup }>>
const transferredGrades = (windowsMap, dateFilter = null) =>
  collect(windowsMap, dateFilter, async ({ groupIds, studentIds, dateFilter: df }) => {
    const grades = await Grade.find({
      group: { $in: groupIds },
      student: { $in: studentIds },
      ...(df ? { date: df } : {}),
    });
    return grades.map((g) => ({
      studentId: String(g.student),
      group: String(g.group),
      date: g.date,
      value: {
        _id: g._id,
        value: g.value,
        note: g.note || "",
        teacher: g.teacher ? String(g.teacher) : null,
        createdAt: g.createdAt,
      },
    }));
  });

module.exports = { sourceWindowsOf, transferredAttendance, transferredGrades };
