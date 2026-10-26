const Student = require("../models/Student");
const Attendance = require("../models/Attendance");
const Grade = require("../models/Grade");
const Homework = require("../models/Homework");
const { currentMonthString } = require("./date.util");

// Oy "YYYY-MM" formati (API_CONTRACT_badges_monthly_rank.md §A).
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// Oy chegarasi — Attendance/Grade `date` "YYYY-MM-DD" STRING, shuning uchun
// oddiy leksik taqqoslash yetarli ("-31" oy necha kunligidan qat'i nazar ishlaydi).
const monthDateRange = (month) => ({ $gte: `${month}-01`, $lte: `${month}-31` });

// Guruh o'quvchilari reytingi — YAGONA manba. Client "O'quvchilar" saralashi
// (`attendance.service.getStudentsSummary`) va ota-ona/o'quvchi WebApp'idagi
// "guruhdagi o'rin" (`parent.service.entryRank`) aynan shu hisobni
// ishlatadi (API_CONTRACT_student_role_homework.md §3.5) — ikki joyda ikki
// xil formula bo'lib qolmasin.

// Baho saralash uchun Bayes o'rtachasi parametrlari: shkala o'rtasi (10
// ballik → 5.5) va "ishonch" og'irligi — kam bahosi bor o'quvchi o'rtaga tortiladi
// (API_CONTRACT_grade_scale10.md §2).
const GRADE_PRIOR_MEAN = 5.5;
const GRADE_PRIOR_WEIGHT = 5;

// Uyga vazifa natijasi reyting uchun 10 ballik "baho" sifatida hisoblanadi:
// bajarildi = 10, qisman = 5, bajarilmadi = 0. Faqat o'qituvchi natija
// belgilagan vazifalar kiradi (belgilanmagani hisobga olinmaydi).
const HOMEWORK_POINTS = { done: 10, partial: 5, missed: 0 };

// IMDb usuli: score = (sum + C·m) / (count + C), 2 xona aniqlikda.
const gradeScore = (sum, count) =>
  Math.round(((sum + GRADE_PRIOR_WEIGHT * GRADE_PRIOR_MEAN) / (count + GRADE_PRIOR_WEIGHT)) * 100) / 100;

// Guruhdagi har bir FAOL o'quvchi bo'yicha BITTA OY (default — joriy oy,
// Asia/Tashkent) davomat foizi va baho ko'rsatkichlari. Reyting har oy
// noldan boshlanadi (API_CONTRACT_badges_monthly_rank.md §A) — butun tarix
// bo'yicha reytingda yangi o'quvchi eski "chempion"ga hech qachon yetolmasdi.
// `group` — Group hujjati (`_id` kerak). Formula o'zgarmagan.
// Qaytaradi: { [studentId]: { attendanceRate, gradeAverage, gradeCount, homeworkRate, gradeScore } }
// `gradeScore` baho + uyga vazifa natijalaridan birga hisoblanadi.
const groupStudentsSummary = async (group, { month } = {}) => {
  const groupId = group._id;
  const range = monthDateRange(MONTH_RE.test(month || "") ? month : currentMonthString());
  const [activeStudentIds, attendanceAgg, gradeAgg, homeworkAgg] = await Promise.all([
    Student.find({ groups: { $elemMatch: { group: groupId, status: "active" } } }).select("_id"),
    Attendance.aggregate([
      { $match: { group: groupId, date: range } },
      { $unwind: "$records" },
      {
        $group: {
          _id: "$records.student",
          total: { $sum: 1 },
          present: { $sum: { $cond: [{ $eq: ["$records.status", "present"] }, 1, 0] } },
        },
      },
    ]),
    Grade.aggregate([
      { $match: { group: groupId, date: range } },
      { $group: { _id: "$student", avg: { $avg: "$value" }, sum: { $sum: "$value" }, count: { $sum: 1 } } },
    ]),
    Homework.aggregate([
      { $match: { group: groupId, date: range, isDeleted: false } },
      { $unwind: "$results" },
      {
        $group: {
          _id: "$results.student",
          sum: {
            $sum: {
              $switch: {
                branches: Object.entries(HOMEWORK_POINTS).map(([status, points]) => ({
                  case: { $eq: ["$results.status", status] },
                  then: points,
                })),
                default: 0,
              },
            },
          },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);
  const homeworkMap = Object.fromEntries(homeworkAgg.map((h) => [String(h._id), h]));

  const attendanceMap = Object.fromEntries(
    attendanceAgg.map((a) => [String(a._id), a.total ? Math.round((a.present / a.total) * 100) : 0]),
  );
  const gradeMap = Object.fromEntries(
    gradeAgg.map((g) => [
      String(g._id),
      { average: Math.round(g.avg * 10) / 10, count: g.count, sum: g.sum },
    ]),
  );

  const summary = {};
  for (const s of activeStudentIds) {
    const id = String(s._id);
    const grade = gradeMap[id];
    const homework = homeworkMap[id];
    const count = (grade?.count ?? 0) + (homework?.count ?? 0);
    summary[id] = {
      attendanceRate: attendanceMap[id] || 0,
      gradeAverage: grade?.average ?? null,
      gradeCount: grade?.count ?? 0,
      homeworkRate: homework ? Math.round((homework.sum / (homework.count * 10)) * 100) : null,
      // Saralash uchun Bayes o'rtachasi — baho + uyga vazifa SONI ham hisobga
      // olinadi: 2 ta "10" olgan o'quvchi 25 ta baho bilan 9.5 o'rtachali
      // o'quvchidan yuqoriga chiqmasin.
      gradeScore: count ? gradeScore((grade?.sum ?? 0) + (homework?.sum ?? 0), count) : null,
    };
  }
  return summary;
};

// Dense rank: `gradeScore` (desc), teng bo'lsa `attendanceRate` (desc), yana
// teng bo'lsa bir xil o'rin. Bahosi yo'q o'quvchi reytingga kirmaydi (null).
// Qaytaradi: { total, ranked, position } — `studentId` uchun.
const rankInSummary = (summary, studentId) => {
  const rows = Object.entries(summary);
  const ranked = rows
    .filter(([, s]) => s.gradeScore !== null)
    .sort(([, a], [, b]) => b.gradeScore - a.gradeScore || b.attendanceRate - a.attendanceRate);

  let position = null;
  let rank = 0;
  let prev = null;
  for (const [id, s] of ranked) {
    if (!prev || prev.gradeScore !== s.gradeScore || prev.attendanceRate !== s.attendanceRate) rank++;
    prev = s;
    if (id === String(studentId)) {
      position = rank;
      break;
    }
  }
  return { total: rows.length, ranked: ranked.length, position };
};

// Barcha reytingdagi o'quvchilarning o'rni bir martada: { [studentId]: position }
// (bahosi yo'qlar kirmaydi). `rankInSummary` bilan AYNAN bir xil tartib.
const positionsInSummary = (summary) => {
  const out = {};
  for (const id of Object.keys(summary)) {
    const { position } = rankInSummary(summary, id);
    if (position !== null) out[id] = position;
  }
  return out;
};

module.exports = {
  MONTH_RE,
  GRADE_PRIOR_MEAN,
  GRADE_PRIOR_WEIGHT,
  monthDateRange,
  gradeScore,
  groupStudentsSummary,
  rankInSummary,
  positionsInSummary,
};
