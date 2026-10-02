// Faqat dev: VITE_USE_MOCK=1 bo'lsa backend o'rniga ishlaydi.
// Shakllar docs/API_CONTRACT_parent.md §4 bo'yicha.
import { ApiError } from "./http";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = Math.floor(Date.now() / 1000);
const DAY = 86400;
const ym = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const pad = (n) => String(n).padStart(2, "0");
const today = new Date();
const TODAY = `${ym(today)}-${pad(today.getDate())}`;

let parent = {
  _id: "p1",
  name: "Sardor Karimov",
  phone: "+998901234567",
  lang: "uz",
  mute: { attendance: false, lessonFinished: false, payment: false, debt: false, lessonReminder: false, homework: false },
  childrenCount: 2,
  // ?mockRole=student — o'quvchi roli; ?mockBoth=1 — ikkala rol mavjud
  role: new URLSearchParams(window.location.search).get("mockRole") === "student" ? "student" : "parent",
  availableRoles: new URLSearchParams(window.location.search).get("mockBoth") === "1" ? ["parent", "student"] : null,
};
if (!parent.availableRoles) parent.availableRoles = [parent.role];

// O'quvchi roli: /parent/children o'quvchining o'zini qaytaradi, to'lov maydonlarisiz
const studentSelf = () => {
  const c = children[0];
  return {
    ...c,
    student: { ...c.student, isSelf: true },
    stats: { ...c.stats, totalDebt: null },
    centers: c.centers.map((ce) => ({ ...ce, groups: ce.groups.map((g) => ({ ...g, debt: null, nextDueDate: null, price: null })) })),
  };
};

const rank = (entryId) =>
  entryId === E_RUS
    ? { total: 9, position: null, ranked: 0, gradeAverage: null, gradeCount: 0, gradeScore: null, attendanceRate: 100 }
    : { total: 14, position: entryId === E_MATH ? 3 : 7, ranked: 11, gradeAverage: entryId === E_MATH ? 8.4 : 7.2, gradeCount: 12, gradeScore: 8.1, attendanceRate: 92, month: ym() };

// ?mockBadges=off — tarif flagi o'chiq (enabled:false); ?mockBadges=empty — hali yutuq yo'q
const badges = (entryId) => {
  const mode = new URLSearchParams(window.location.search).get("mockBadges");
  if (mode === "off") return { enabled: false };
  const m = ym();
  const prev = (n) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - n); return ym(d); };
  const progress = {
    perfectAttendance: { current: 7, target: 7, min: 4, absent: 0 },
    excellent: { current: 3, min: 4, minValue: 8, broken: false, achieved: false },
    perfect: { current: 2, target: 3, min: 4, broken: true, achieved: false },
    attendanceStreak: { current: 6, target: 10 },
    gradeStreak: { current: 0, target: 5, achieved: entryId === E_MATH },
    champion: { position: entryId === E_MATH ? 1 : 4, total: 14 },
    mostImproved: { delta: 0.6, prevAverage: 7.4, average: 8.0 },
    podiumStreak: { current: 1, target: 3, podiumNow: true, achieved: false },
    goldCollection: { current: 1, target: 3, done: false, achieved: false },
    bigJump: { prevPosition: 9, position: 3, jump: 6, target: 5, achieved: true },
  };
  const earned = mode === "empty" || entryId === E_RUS ? [] : [
    { type: "perfectAttendance", count: 3, months: [prev(1), prev(3), prev(4)] },
    { type: "champion", count: 1, months: [prev(1)] },
    { type: "attendanceStreak", count: 2, months: [prev(2), prev(5)] },
    { type: "gradeStreak", count: 1, months: [prev(2)] },
    { type: "podiumStreak", count: 1, months: [prev(1)] },
    { type: "goldCollection", count: 1, months: [prev(1)] },
    { type: "bigJump", count: 1, months: [prev(4)] },
  ];
  const medals = mode === "empty" || entryId === E_RUS ? [] : [
    { month: prev(1), position: 1, total: 14 },
    { month: prev(2), position: 3, total: 14 },
    { month: prev(4), position: 2, total: 13 },
  ];
  return { enabled: true, month: m, earned, medals, progress, gradesHidden: false };
};

const homework = (entryId, month) => {
  if (entryId === E_RUS) return { month, items: [] };
  const d = (off) => { const x = new Date(); x.setDate(x.getDate() + off); return `${ym(x)}-${pad(x.getDate())}`; };
  const all = [
    { date: d(2), text: "Mavzu: Progressiyalar\n1) 45-bet, 3-7 mashqlar\n2) Formulalarni yodlash" },
    { date: d(1), text: "12-mashq, 45-bet (www.kitob.uz/algebra-9). Savollar bo'lsa: https://t.me/wenetuz." },
    { date: d(0), text: "Kvadrat tenglamalar bo'yicha test (20 ta savol): https://forms.gle/Xy7kQ2abcDEF12345\nVideo dars: https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG&index=3" },
    { date: d(-2), text: "Tengsizliklar: 38-bet, 1-10." },
    { date: d(-5), text: "Takrorlash: 1-3 mavzular." },
  ].map((x, i) => ({ ...x, updatedAt: Date.now() - i * 3600e3 }));
  return { month, items: all.filter((x) => x.date.startsWith(month)) };
};

const E_MATH = "e-math", E_ENG = "e-eng", E_IELTS = "e-ielts", E_RUS = "e-rus";

const children = [
  {
    student: { _id: "s1", fullName: "Ali Karimov", phone: "+998901111111", isSelf: false },
    stats: { attendancePercent: 92, avgGrade: 9.2, totalDebt: 630000 },
    centers: [
      {
        center: { _id: "c1", name: "Chilonzor filiali · Wenet Learning Center" },
        linked: true,
        groups: [
          { entryId: E_ENG, groupId: "g1", name: "English Beginner A1", subjectName: "Ingliz tili", teacherName: "Dilshod Rahimov", roomName: "203", days: [1, 3, 5], startTime: "09:00", endTime: "10:30", status: "active", price: 450000, debt: 0, nextDueDate: now + 10 * DAY, todayStatus: "present", late: false },
          { entryId: E_MATH, groupId: "g2", name: "Matematika 9-sinf (kuchaytirilgan, DTM tayyorlov)", subjectName: "Matematika", teacherName: "Sardor Tursunov", roomName: "101", days: [1, 3, 5], startTime: "15:00", endTime: "16:30", status: "active", price: 400000, debt: 630000, nextDueDate: now + 10 * DAY, todayStatus: null, late: false },
          { entryId: E_RUS, groupId: "g3", name: "Rus tili boshlang'ich", subjectName: "Rus tili", teacherName: "Nigora Karimova", roomName: "102", days: [2, 4], startTime: "11:00", endTime: "12:00", status: "finished", price: 300000, debt: 0, nextDueDate: null, todayStatus: null, late: false },
        ],
      },
      { center: { _id: "c2", name: "Yunusobod filiali" }, linked: false, groups: [] },
    ],
    today: [
      { entryId: E_ENG, name: "English Beginner A1", centerName: "Chilonzor filiali", startTime: "09:00", endTime: "10:30", status: "present" },
      { entryId: E_MATH, name: "Matematika 9-sinf", centerName: "Chilonzor filiali", startTime: "15:00", endTime: "16:30", status: null },
    ],
  },
  {
    student: { _id: "s2", fullName: "Laylo Karimova", phone: "+998902222222", isSelf: false },
    stats: { attendancePercent: 100, avgGrade: null, totalDebt: 0 },
    centers: [
      {
        center: { _id: "c2", name: "Yunusobod filiali" },
        linked: true,
        groups: [
          { entryId: E_IELTS, groupId: "g4", name: "IELTS 6.5+", subjectName: "IELTS", teacherName: "Madina Yusupova", roomName: "5", days: [1, 3, 5], startTime: "09:00", endTime: "10:30", status: "active", price: 900000, debt: 0, nextDueDate: now + 20 * DAY, todayStatus: "present", late: true },
        ],
      },
    ],
    today: [
      { entryId: E_IELTS, name: "IELTS 6.5+", centerName: "Yunusobod filiali", startTime: "09:00", endTime: "10:30", status: "present" },
    ],
  },
];

const lessonDaysFor = (month, days) => {
  const [y, m] = month.split("-").map(Number);
  const out = [];
  const d = new Date(y, m - 1, 1);
  while (d.getMonth() === m - 1) {
    const dow = d.getDay() === 0 ? 7 : d.getDay();
    if (days.includes(dow)) out.push(`${month}-${pad(d.getDate())}`);
    d.setDate(d.getDate() + 1);
  }
  return out;
};

const attendance = (entryId, month) => {
  const ld = lessonDaysFor(month, [1, 3, 5]);
  const past = ld.filter((x) => x < TODAY);
  const statuses = ["present", "present", "present", "late", "present", "excused", "absent", "present"];
  const days = past.map((date, i) => {
    const s = statuses[i % statuses.length];
    return { date, status: s === "late" ? "present" : s, late: s === "late", reason: s === "excused" ? "Kasal" : null };
  });
  const summary = {
    present: days.filter((d) => d.status === "present").length,
    absent: days.filter((d) => d.status === "absent").length,
    excused: days.filter((d) => d.status === "excused").length,
    late: days.filter((d) => d.late).length,
  };
  return { month, days, summary, lessonDays: ld };
};

const grades = (entryId, month) => {
  const att = attendance(entryId, month);
  const topics = ["Kirish testi", "Kvadrat tenglamalar", "Kvadrat tenglamalar", "Tengsizliklar", "Tengsizliklar", "Funksiya va grafik", "Progressiyalar"];
  const items = att.days
    .filter((d) => d.status === "present")
    .map((d, i) => ({ date: d.date, value: [10, 8, 9, 6, 10][i % 5], note: i === 3 ? "Uy vazifasini bajarmagan. Tengsizliklarni qayta ko'rib chiqish kerak." : null, topic: topics[i % topics.length] }))
    .reverse();
  const avg = items.length ? Math.round((items.reduce((a, b) => a + b.value, 0) / items.length) * 10) / 10 : null;
  return { month, items, avg, gradesHidden: entryId === E_IELTS };
};

const entryPayments = (entryId) => {
  const m0 = ym(new Date(today.getFullYear(), today.getMonth() - 1, 1));
  const m1 = ym(today);
  const isMath = entryId === E_MATH;
  return {
    price: isMath ? 400000 : 450000,
    debt: isMath ? 630000 : 0,
    debtBreakdown: isMath
      ? [
          { month: m0, due: 400000, paid: 170000, debt: 230000, kind: "cycle" },
          { month: m1, due: 400000, paid: 0, debt: 400000, kind: "cycle" },
        ]
      : [],
    nextDueDate: now + 10 * DAY,
    payments: [
      { _id: "pay1", amount: 170000, type: "cash", status: "active", forMonth: m0, date: now - 40 * DAY, code: "A7K3M2QX", collectedByName: "Nigora Karimova" },
      { _id: "pay2", amount: 400000, type: "card", status: "active", forMonth: m0, date: now - 75 * DAY, code: "B8L4N3RY", collectedByName: "Nigora Karimova" },
      { _id: "pay3", amount: 400000, type: "card", status: "refunded", forMonth: m0, date: now - 105 * DAY, code: "C9M5P4SZ", collectedByName: "Nigora Karimova" },
    ],
    receiptVerifyBase: "https://wenet.uz/payment/verify",
  };
};

const allPayments = () => {
  const m0 = ym(new Date(today.getFullYear(), today.getMonth() - 1, 1));
  const m1 = ym(today);
  return {
    totalDebt: 630000,
    debts: [
      { student: { _id: "s1", fullName: "Ali Karimov" }, centerName: "Chilonzor filiali", groupName: "Matematika 9-sinf", entryId: E_MATH, debt: 630000, nextDueDate: now + 10 * DAY },
    ],
    months: [
      { month: m1, items: [
        { student: { _id: "s1", fullName: "Ali Karimov" }, centerName: "Chilonzor filiali", groupName: "English Beginner A1", amount: 450000, type: "card", date: now - 1 * DAY, code: "D1E2F3G4" },
        { student: { _id: "s2", fullName: "Laylo Karimova" }, centerName: "Yunusobod filiali", groupName: "IELTS 6.5+", amount: 900000, type: "cash", date: now - 17 * DAY, code: "H5I6J7K8" },
      ] },
      { month: m0, items: [
        { student: { _id: "s1", fullName: "Ali Karimov" }, centerName: "Chilonzor filiali", groupName: "Matematika 9-sinf", amount: 170000, type: "cash", date: now - 40 * DAY, code: "A7K3M2QX" },
      ] },
    ],
  };
};

const notifs = [
  { _id: "n1", type: "parent:attendance", title: "Laylo IELTS darsiga keldi", body: "Yunusobod filiali", createdAt: now - 3600, data: { status: "present", centerName: "Yunusobod filiali", studentName: "Laylo Karimova", groupName: "IELTS 6.5+" }, read: false },
  { _id: "n2", type: "parent:lessonFinished", title: "Dars tugadi — Laylo, IELTS 6.5+", body: "Baho: 10 · Keyingi dars: ertaga 09:00", createdAt: now - 1800, data: { centerName: "Yunusobod filiali", grade: 10 }, read: false },
  { _id: "n3", type: "parent:payment", title: "To'lov qabul qilindi — Ali, Ingliz tili", body: "450 000 so'm · Sentabr uchun · qarz yo'q", createdAt: now - DAY - 3600, data: { centerName: "Chilonzor filiali", amount: 450000, code: "D1E2F3G4" }, read: true },
  { _id: "n4", type: "parent:attendance", title: "Ali Matematika darsiga kelmadi", body: "Chilonzor filiali", createdAt: now - 3 * DAY, data: { status: "absent", centerName: "Chilonzor filiali" }, read: true },
  { _id: "n6", type: "parent:badge", title: "Yangi yutuqlar — Ali Karimov", body: "Chilonzor filiali · Matematika 9-sinf\nAvgust oyi uchun:\n• 📅 Mukammal davomat\n• 🏆 Guruh chempioni", createdAt: now - 2 * DAY, data: { centerName: "Chilonzor filiali", studentId: "s1", entryId: E_MATH, month: "2026-08", types: ["perfectAttendance", "champion"] }, read: true },
  { _id: "n5", type: "parent:debt", title: "Qarzdorlik eslatmasi", body: "Ali · Matematika 9-sinf · 630 000 so'm · muddat 1-okt", createdAt: now - 3 * DAY - 7200, data: { centerName: "Chilonzor filiali", total: 630000 }, read: true },
];

// ?mockPlan=off — tarifda dars rejalash yo'q; ?mockPlan=empty — reja tuzilmagan
const lessonPlan = () => {
  const mode = new URLSearchParams(window.location.search).get("mockPlan");
  if (mode === "off") return { enabled: false };
  if (mode === "empty") return { enabled: true, hasPlan: false };
  const d = (off) => { const x = new Date(); x.setDate(x.getDate() + off); return `${ym(x)}-${pad(x.getDate())}`; };
  const L = (no, title, moduleTitle) => ({ no, title, moduleTitle, description: "" });
  return {
    enabled: true,
    hasPlan: true,
    today: d(0),
    progress: { doneCount: 8, totalLessons: 20, nextNo: 9, finished: false, moduleCount: 3, currentModuleIndex: 1 },
    todayItem: { date: d(0), type: "lesson", lesson: L(9, "Present Continuous", "Modul 2") },
    upcoming: [
      { date: d(2), type: "holiday", note: "Navro'z" },
      { date: d(5), type: "lesson", lesson: L(10, "Past Simple", "Modul 2") },
      { date: d(7), type: "lesson", lesson: L(11, "Irregular verbs", "Modul 2") },
      { date: d(9), type: "lesson", lesson: L(12, "Past Continuous", "Modul 2") },
    ],
    past: [
      { date: d(-2), lesson: L(8, "Present Simple — savollar", "Modul 2") },
      { date: d(-5), lesson: L(7, "Present Simple", "Modul 2") },
      { date: d(-7), lesson: L(6, "Takrorlash", "Modul 1") },
    ],
    modules: [
      { title: "Modul 1", lessons: [1, 2, 3, 4, 5, 6].map((no) => ({ no, title: `Mavzu ${no}`, state: "done" })) },
      { title: "Modul 2", lessons: [7, 8, 9, 10, 11, 12, 13].map((no) => ({ no, title: `Mavzu ${no}`, state: no <= 8 ? "done" : no === 9 ? "current" : "upcoming" })) },
      { title: "Modul 3", lessons: [14, 15, 16, 17, 18, 19, 20].map((no) => ({ no, title: `Mavzu ${no}`, state: "upcoming" })) },
    ],
  };
};

export const mockRequest = async (method, url, body, params) => {
  await sleep(350);
  const q = new URLSearchParams(window.location.search);
  if (url === "/parent-auth/telegram") {
    if (q.get("mockNotLinked") === "1") throw new ApiError("parent.notLinked");
    return { access: "mock-token", parent };
  }
  if (url === "/parent/me") return parent;
  if (url === "/parent/role") {
    if (!["parent", "student"].includes(body?.role)) throw new ApiError("parent.invalidRole", 400);
    if (!parent.availableRoles.includes(body.role)) throw new ApiError("parent.roleNotAvailable", 403);
    parent = { ...parent, role: body.role };
    return parent;
  }
  const isStudent = parent.role === "student";
  if (url === "/parent/children" && isStudent) return [studentSelf()];
  if (isStudent && (url === "/parent/payments" || /\/payments$/.test(url))) throw new ApiError("parent.forbiddenForStudent", 403);
  if (url === "/parent/children") {
    if (q.get("mockEmpty") === "1") return [];
    if (q.get("mockOne") === "1") return [children[0]];
    if (q.get("mockError") === "1") throw new ApiError("error.network");
    return children;
  }
  let m = url.match(/^\/parent\/entries\/([^/]+)\/attendance$/);
  if (m) return attendance(m[1], params?.month || ym());
  m = url.match(/^\/parent\/entries\/([^/]+)\/grades$/);
  if (m) return grades(m[1], params?.month || ym());
  m = url.match(/^\/parent\/entries\/([^/]+)\/rank$/);
  if (m) return rank(m[1]);
  m = url.match(/^\/parent\/entries\/([^/]+)\/badges$/);
  if (m) return badges(m[1]);
  m = url.match(/^\/parent\/entries\/([^/]+)\/lesson-plan$/);
  if (m) return lessonPlan();
  m = url.match(/^\/parent\/entries\/([^/]+)\/homework$/);
  if (m) return homework(m[1], params?.month || ym());
  m = url.match(/^\/parent\/entries\/([^/]+)\/payments$/);
  if (m) return entryPayments(m[1]);
  if (url === "/parent/payments") return allPayments();
  if (url === "/parent/notifications") {
    const t = params?.type;
    const data = t ? notifs.filter((n) => n.type === t) : notifs;
    return { data, meta: { page: 1, limit: 30, total: data.length, totalPages: 1 } };
  }
  if (url === "/parent/notifications/read-all") return { updated: notifs.length };
  if (url === "/parent/settings") {
    parent = { ...parent, ...(body?.lang ? { lang: body.lang } : {}), mute: { ...parent.mute, ...(body?.mute || {}) } };
    return parent;
  }
  if (url === "/parent/unlink") return { ok: true };
  throw new ApiError("http.404");
};
