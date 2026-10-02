// Video demo uchun REAL ismli test bazasi.
// +998931042255 owner'ga 2 ta filial va har biriga to'liq data (xona, fan,
// hodim, guruh, o'quvchi, to'lov, davomat, baho, xarajat, oylik, lidlar,
// kurs dasturi) qo'shadi. Mavjud client/obunaga tegmaydi.
//
//   node scripts/seed-video-demo.js
require("dotenv").config();
const mongoose = require("mongoose");
const moment = require("moment-timezone");
const env = require("../src/configs/env.config");
const { getHash } = require("../src/utils/hash.util");
const { getNow, formatMonth, dateStringToUnix } = require("../src/utils/date.util");
const { generateUniqueShortCode } = require("../src/utils/shortCode.util");

const Client = require("../src/models/Client");
const Center = require("../src/models/Center");
const Room = require("../src/models/Room");
const Subject = require("../src/models/Subject");
const Staff = require("../src/models/Staff");
const Group = require("../src/models/Group");
const Student = require("../src/models/Student");
const Attendance = require("../src/models/Attendance");
const Grade = require("../src/models/Grade");
const Expense = require("../src/models/Expense");
const SalaryTransaction = require("../src/models/SalaryTransaction");
const StudentLead = require("../src/models/StudentLead");
const Syllabus = require("../src/models/Syllabus");
const BillingSetting = require("../src/models/BillingSetting");
const Counter = require("../src/models/Counter");

const TZ = "Asia/Tashkent";
const PHONE = "+998931042255";
const PASSWORD = "claude-test-pass";

// Deterministik random — har ishga tushirishda bir xil natija
let seed = 20260921;
const rnd = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

const MALE = ["Jasur", "Sardor", "Bekzod", "Otabek", "Sherzod", "Rustam", "Ulug'bek", "Farrux", "Javlon", "Doston", "Ilyos", "Sanjar", "Akmal", "Bobur", "Aziz", "Shohruh", "Temur", "Abbos", "Mirjalol", "Diyorbek", "Islom", "Asadbek", "Nodir", "Jahongir", "Abror", "Muhammadali", "Firdavs", "Bunyod", "Samandar", "Alisher"];
const FEMALE = ["Dilnoza", "Nodira", "Malika", "Zarina", "Gulnoza", "Madina", "Feruza", "Sevinch", "Nilufar", "Ziyoda", "Kamola", "Munisa", "Diyora", "Shahnoza", "Lola", "Nigora", "Mohira", "Umida", "Sabina", "Iroda", "Laylo", "Maftuna", "Gulsanam", "Ruxshona", "Charos", "Odina", "Shaxlo", "Dildora", "Yulduz", "Nozima"];
const SURNAME = ["Karimov", "Yusupov", "Rashidov", "Toshev", "Nazarov", "Ergashev", "Xolmatov", "Saidov", "Umarov", "Qodirov", "Mirzayev", "Abdullayev", "Rahimov", "Tursunov", "Sobirov", "Ismoilov", "Mahmudov", "Jo'rayev", "Nurmatov", "Hasanov", "Olimov", "Ahmedov", "Boboev", "Sultonov", "Xudoyberdiyev"];

const usedNames = new Set();
const fullName = (gender) => {
  for (let i = 0; i < 50; i++) {
    const first = pick(gender === "f" ? FEMALE : MALE);
    let last = pick(SURNAME);
    if (gender === "f") last += "a";
    const n = `${first} ${last}`;
    if (!usedNames.has(n)) {
      usedNames.add(n);
      return n;
    }
  }
  return `${pick(MALE)} ${pick(SURNAME)}`;
};

let phoneSeq = 7100001;
const freePhone = async () => {
  for (;;) {
    const p = `+99899${phoneSeq++}`;
    if (!(await Student.exists({ phone: p }))) return p;
  }
};
const parentPhone = () => `+99890${rint(1000000, 9999999)}`;

const DAY_IDX = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
// Guruh kunlariga mos, activatedAt'dan bugungacha (bugun kirmaydi) sanalar
const lessonDates = (days, fromUnix, nowUnix) => {
  const out = [];
  const cur = moment.unix(fromUnix).tz(TZ).startOf("day");
  const today = moment.unix(nowUnix).tz(TZ).startOf("day");
  const wanted = new Set(days.map((d) => DAY_IDX[d]));
  while (cur.isBefore(today)) {
    if (wanted.has(cur.day())) out.push(cur.format("YYYY-MM-DD"));
    cur.add(1, "day");
  }
  return out;
};

const CENTERS = [
  {
    name: "Chilonzor filiali",
    slogan: "Bilim — kelajak kaliti",
    subjects: [
      { name: "Ingliz tili", price: 450000 },
      { name: "Matematika", price: 400000 },
      { name: "Rus tili", price: 380000 },
      { name: "Dasturlash (Frontend)", price: 650000 },
    ],
    rooms: ["101-xona", "102-xona", "103-xona", "Konferens zal"],
    reception: { name: "Nigora Karimova", login: "nigora" },
    teachers: [
      { name: "Dilshod Rahimov", login: "dilshod", subjectIdx: [0], salary: { type: "percentage", value: 40 }, gender: "m" },
      { name: "Madina Yusupova", login: "madina", subjectIdx: [0, 2], salary: { type: "percentage", value: 35 }, gender: "f" },
      { name: "Sardor Tursunov", login: "sardor", subjectIdx: [1], salary: { type: "fixed", value: 4500000 }, gender: "m" },
      { name: "Javlon Mahmudov", login: "javlon", subjectIdx: [3], salary: { type: "percentage", value: 45 }, gender: "m" },
    ],
    assistant: { name: "Sevinch Olimova", login: "sevinch", subjectIdx: [0] },
    groups: [
      { name: "English Beginner A1", subjectIdx: 0, teacherIdx: 0, roomIdx: 0, days: ["mon", "wed", "fri"], start: "09:00", end: "10:30", students: 11 },
      { name: "English Pre-Intermediate", subjectIdx: 0, teacherIdx: 1, roomIdx: 1, days: ["tue", "thu", "sat"], start: "14:00", end: "15:30", students: 9 },
      { name: "Matematika 9-sinf", subjectIdx: 1, teacherIdx: 2, roomIdx: 2, days: ["mon", "wed", "fri"], start: "15:00", end: "16:30", students: 12 },
      { name: "Rus tili boshlang'ich", subjectIdx: 2, teacherIdx: 1, roomIdx: 0, days: ["tue", "thu", "sat"], start: "10:00", end: "11:30", students: 8 },
      { name: "Frontend (React) — 1-oqim", subjectIdx: 3, teacherIdx: 3, roomIdx: 3, days: ["mon", "wed", "fri"], start: "18:00", end: "20:00", students: 10 },
    ],
  },
  {
    name: "Yunusobod filiali",
    slogan: "Kelajak shu yerdan boshlanadi",
    subjects: [
      { name: "Ingliz tili", price: 480000 },
      { name: "IELTS tayyorlov", price: 900000 },
      { name: "Matematika", price: 420000 },
      { name: "Koreys tili", price: 500000 },
    ],
    rooms: ["201-xona", "202-xona", "203-xona"],
    reception: { name: "Kamola Nazarova", login: "kamola" },
    teachers: [
      { name: "Bekzod Ismoilov", login: "bekzod", subjectIdx: [0, 1], salary: { type: "percentage", value: 40 }, gender: "m" },
      { name: "Nilufar Sobirova", login: "nilufar", subjectIdx: [0], salary: { type: "percentage", value: 35 }, gender: "f" },
      { name: "Otabek Hasanov", login: "otabek", subjectIdx: [2], salary: { type: "fixed", value: 5000000 }, gender: "m" },
      { name: "Diyora Ahmedova", login: "diyora", subjectIdx: [3], salary: { type: "percentage", value: 40 }, gender: "f" },
    ],
    assistant: { name: "Abror Nurmatov", login: "abror", subjectIdx: [1] },
    groups: [
      { name: "IELTS 6.5+ Intensive", subjectIdx: 1, teacherIdx: 0, roomIdx: 0, days: ["mon", "tue", "wed", "thu", "fri"], start: "09:00", end: "11:00", students: 8 },
      { name: "English Elementary", subjectIdx: 0, teacherIdx: 1, roomIdx: 1, days: ["mon", "wed", "fri"], start: "14:00", end: "15:30", students: 12 },
      { name: "English Intermediate B1", subjectIdx: 0, teacherIdx: 0, roomIdx: 1, days: ["tue", "thu", "sat"], start: "16:00", end: "17:30", students: 10 },
      { name: "Matematika (abituriyent)", subjectIdx: 2, teacherIdx: 2, roomIdx: 2, days: ["tue", "thu", "sat"], start: "09:00", end: "10:30", students: 13 },
      { name: "Koreys tili TOPIK I", subjectIdx: 3, teacherIdx: 3, roomIdx: 2, days: ["mon", "wed", "fri"], start: "17:00", end: "18:30", students: 9 },
    ],
  },
];

const RECEPTION_PERMS = [
  "dashboard:view",
  "group:view", "group:create", "group:update",
  "student:view", "student:create", "student:update",
  "lead:view", "lead:create", "lead:update",
  "subject:view",
  "payment:view", "payment:create",
  "attendance:view", "attendance:create", "attendance:update",
  "expense:view", "expense:create",
  "calendar:view",
  "archive:view",
];
const TEACHER_PERMS = [
  "group:view", "student:view", "subject:view",
  "attendance:view", "attendance:create", "attendance:update",
  "lesson:view", "lesson:create", "lesson:update",
];

const SYLLABI = {
  "Ingliz tili": [
    { title: "Modul 1 — Kirish", lessons: ["Alifbo va talaffuz", "Salomlashish va tanishuv", "To be fe'li", "Sonlar va vaqt"] },
    { title: "Modul 2 — Kundalik hayot", lessons: ["Oila va do'stlar", "Present Simple", "Kunlik tartib", "Ovqat va restoran"] },
    { title: "Modul 3 — Sayohat", lessons: ["Yo'nalish so'rash", "Past Simple", "Mehmonxona va aeroport", "Takrorlash va test"] },
  ],
  "IELTS tayyorlov": [
    { title: "Listening", lessons: ["Section 1-2 strategiyalari", "Map & Diagram labelling", "Multiple choice", "Mock test 1"] },
    { title: "Reading", lessons: ["Skimming & Scanning", "True/False/Not Given", "Matching headings", "Mock test 2"] },
    { title: "Writing", lessons: ["Task 1 — grafiklar", "Task 2 — Opinion essay", "Task 2 — Discussion essay", "Band 7 xatolar tahlili"] },
    { title: "Speaking", lessons: ["Part 1 savollari", "Part 2 cue card", "Part 3 munozara", "Mock speaking"] },
  ],
  "Matematika": [
    { title: "Algebra", lessons: ["Kvadrat tenglamalar", "Tengsizliklar", "Funksiya va grafik", "Progressiyalar"] },
    { title: "Geometriya", lessons: ["Uchburchaklar", "Aylana va doira", "Ko'pburchaklar", "Stereometriya asoslari"] },
    { title: "Test tayyorlov", lessons: ["DTM namunaviy test 1", "DTM namunaviy test 2", "Xatolar tahlili"] },
  ],
  "Rus tili": [
    { title: "Modul 1", lessons: ["Alifbo", "Tanishuv", "Otlarning rodlari", "Sonlar"] },
    { title: "Modul 2", lessons: ["Kelishiklar", "Fe'l zamonlari", "Dialoglar", "Takrorlash"] },
  ],
  "Dasturlash (Frontend)": [
    { title: "HTML & CSS", lessons: ["HTML asoslari", "CSS selektorlar", "Flexbox", "Grid va responsive"] },
    { title: "JavaScript", lessons: ["O'zgaruvchilar va tiplar", "Funksiyalar", "DOM", "Fetch API va async/await"] },
    { title: "React", lessons: ["Komponentlar va props", "useState / useEffect", "React Router", "Yakuniy loyiha"] },
  ],
  "Koreys tili": [
    { title: "Hangul", lessons: ["Unlilar", "Undoshlar", "Bo'g'in tuzish", "O'qish mashqi"] },
    { title: "Grammatika", lessons: ["-입니다 / -예요", "Sonlar (sino va koreys)", "Fe'l qo'shimchalari", "TOPIK I namunaviy test"] },
  ],
};

const LEAD_NOTES = ["Instagram reklamasini ko'rib qo'ng'iroq qildi", "Ukasi shu yerda o'qiydi", "Narx bo'yicha so'radi, o'ylab ko'radi", "Ertalabki guruh kerak", "Sinov darsiga yozildi", ""];

const run = async () => {
  await mongoose.connect(env.MONGO_URI);
  const now = getNow();
  const thisMonth = formatMonth(now);
  const m = moment.unix(now).tz(TZ);
  const monthAgo = (n) => m.clone().subtract(n, "month").format("YYYY-MM");
  const startOfMonthsAgo = (n) => dateStringToUnix(m.clone().subtract(n, "month").startOf("month").format("YYYY-MM-DD"));

  const client = await Client.findOne({ phone: PHONE, isDeleted: false });
  if (!client) throw new Error("Client topilmadi: " + PHONE);
  if (!client.subscription) throw new Error("Clientda obuna yo'q — avval seedDemo.js");

  const live = await Center.countDocuments({ client: client._id, isDeleted: false });
  if (live > 0) {
    console.log(`Diqqat: clientda allaqachon ${live} ta tirik filial bor. Davom etilmoqda (yangilari qo'shiladi).`);
  }

  const seenCodes = new Set();
  const payCode = async () => {
    const c = await generateUniqueShortCode(async (x) => seenCodes.has(x) || (await Student.exists({ "groups.payments.code": x })));
    seenCodes.add(c);
    return c;
  };

  const summary = { centers: 0, rooms: 0, subjects: 0, staff: 0, groups: 0, students: 0, payments: 0, attendance: 0, grades: 0, expenses: 0, salaryTx: 0, leads: 0, syllabi: 0 };
  const hashed = await getHash(PASSWORD);

  for (const cfg of CENTERS) {
    const center = await Center.create({ client: client._id, name: cfg.name, slogan: cfg.slogan, status: "active" });
    summary.centers++;
    await BillingSetting.create({ client: client._id, center: center._id, cycleMode: "calendarMonth" });

    const rooms = [];
    for (const name of cfg.rooms) {
      rooms.push(await Room.create({ client: client._id, center: center._id, name, capacity: rint(12, 20) }));
      summary.rooms++;
    }
    const subjects = [];
    for (const s of cfg.subjects) {
      subjects.push(await Subject.create({ client: client._id, center: center._id, name: s.name, price: s.price, durationMonths: s.name.includes("IELTS") ? 3 : 1 }));
      summary.subjects++;
    }

    const reception = await Staff.create({
      client: client._id, center: center._id, name: cfg.reception.name, login: cfg.reception.login,
      password: hashed, role: "reception", permissions: [...RECEPTION_PERMS, "staff.salary.fixed"], salaryValue: 3500000,
      // Video demo: intro-tur sahifani yopib qo'ymasin (birinchi kirishda chiqadi).
      introSeen: true,
    });
    summary.staff++;
    usedNames.add(cfg.reception.name);

    const teachers = [];
    for (const t of cfg.teachers) {
      teachers.push(await Staff.create({
        client: client._id, center: center._id, name: t.name, login: t.login, password: hashed, role: "teacher",
        permissions: [...TEACHER_PERMS, `staff.salary.${t.salary.type}`],
        subjects: t.subjectIdx.map((i) => subjects[i]._id),
        salaryValue: t.salary.value,
        introSeen: true,
      }));
      summary.staff++;
      usedNames.add(t.name);
    }
    const assistant = await Staff.create({
      client: client._id, center: center._id, name: cfg.assistant.name, login: cfg.assistant.login, password: hashed, role: "assistant",
      permissions: [...TEACHER_PERMS, "staff.salary.fixed"], subjects: cfg.assistant.subjectIdx.map((i) => subjects[i]._id), salaryValue: 2000000,
      introSeen: true,
    });
    summary.staff++;
    usedNames.add(cfg.assistant.name);

    const activatedAt = startOfMonthsAgo(2);
    const groups = [];
    for (const g of cfg.groups) {
      const pendingId = await Counter.next(`group_pending_${client.clientId}`);
      const activeId = await Counter.next(`group_active_${client.clientId}`);
      const group = await Group.create({
        client: client._id, center: center._id, name: g.name,
        subject: subjects[g.subjectIdx]._id, teacher: teachers[g.teacherIdx]._id,
        assistant: g.subjectIdx === cfg.assistant.subjectIdx[0] && groups.length === 0 ? assistant._id : null,
        room: rooms[g.roomIdx]._id, days: g.days, startTime: g.start, endTime: g.end,
        maxStudents: 15, status: "active", pendingId, activeId, activatedAt,
      });
      groups.push({ group, cfg: g, subject: subjects[g.subjectIdx], teacher: teachers[g.teacherIdx] });
      summary.groups++;

      const syl = SYLLABI[subjects[g.subjectIdx].name];
      if (syl) {
        await Syllabus.create({
          client: client._id, center: center._id, group: group._id,
          modules: syl.map((mod) => ({ title: mod.title, lessons: mod.lessons.map((l) => ({ title: l })) })),
        });
        summary.syllabi++;
      }
    }

    // Bitta guruhda 1 ta pending guruh ham bo'lsin (yangi ochilayotgan)
    {
      const pendingId = await Counter.next(`group_pending_${client.clientId}`);
      await Group.create({
        client: client._id, center: center._id, name: `${subjects[0].name} — yangi guruh`,
        subject: subjects[0]._id, teacher: teachers[0]._id, room: rooms[0]._id,
        days: ["tue", "thu", "sat"], startTime: "11:00", endTime: "12:30", maxStudents: 12, status: "pending", pendingId,
      });
      summary.groups++;
    }

    // O'quvchilar
    const centerStudents = []; // { student, groupIds }
    for (let gi = 0; gi < groups.length; gi++) {
      const { group, cfg: g, subject } = groups[gi];
      for (let si = 0; si < g.students; si++) {
        // ~15% o'quvchi boshqa guruhga ham qo'shiladi (ikkinchi guruh sifatida)
        const reuse = si > 0 && rnd() < 0.15 ? pick(centerStudents.filter((cs) => !cs.groupIds.has(String(group._id)))) : null;
        const gender = rnd() < 0.5 ? "m" : "f";
        const joinedAt = rnd() < 0.8 ? activatedAt : startOfMonthsAgo(1);
        const price = subject.price;
        const months = joinedAt === activatedAt ? [monthAgo(2), monthAgo(1), thisMonth] : [monthAgo(1), thisMonth];

        // To'lov stsenariysi: 60% to'liq, 20% joriy oy to'lamagan (qarz), 15% qisman, 5% ortiqcha (avans)
        const scenario = rnd();
        const payments = [];
        for (let mi = 0; mi < months.length; mi++) {
          const mo = months[mi];
          const isCurrent = mo === thisMonth;
          let amount = price;
          if (isCurrent && scenario < 0.2) continue; // qarz
          if (isCurrent && scenario >= 0.2 && scenario < 0.35) amount = Math.round(price * pick([0.4, 0.5, 0.6]) / 10000) * 10000; // qisman
          const monthStart = dateStringToUnix(mo + "-01");
          const date = isCurrent ? Math.min(now - rint(1, 5) * 86400, now - 3600) : monthStart + rint(1, 8) * 86400 + rint(9, 18) * 3600;
          payments.push({
            amount, type: pick(["cash", "card", "card", "cash", "mixed"]), status: "paid",
            note: pick(["", "", "Oylik to'lov", "Click orqali", ""]),
            forMonth: mo, collectedBy: reception._id, collectedByKind: "staff", date, code: await payCode(),
          });
          summary.payments++;
        }
        if (scenario >= 0.95) {
          payments.push({ amount: price, type: "card", status: "paid", note: "Keyingi oy uchun oldindan", forMonth: m.clone().add(1, "month").format("YYYY-MM"), collectedBy: reception._id, collectedByKind: "staff", date: now - 86400, code: await payCode() });
          summary.payments++;
        }

        const entry = {
          group: group._id, center: center._id, client: client._id, subject: subject._id,
          price, priceHistory: [{ price, from: joinedAt }], status: "active", joinedAt, payments,
        };

        if (reuse) {
          reuse.student.groups.push(entry);
          await reuse.student.save();
          reuse.groupIds.add(String(group._id));
        } else {
          const student = await Student.create({
            phone: await freePhone(), fullName: fullName(gender), parentPhone: rnd() < 0.7 ? parentPhone() : "", groups: [entry],
          });
          centerStudents.push({ student, groupIds: new Set([String(group._id)]) });
          summary.students++;
        }
      }
    }

    // Har guruhdan 1 ta "ketgan" o'quvchi (left) — arxiv/ketganlar ko'rinsin
    for (const { group } of groups.slice(0, 2)) {
      const cs = centerStudents.find((c) => c.groupIds.has(String(group._id)) && c.groupIds.size === 1 && c.student.groups.length === 1);
      if (!cs) continue;
      const e = cs.student.groups[0];
      e.status = "left";
      e.leftAt = now - rint(3, 10) * 86400;
      await cs.student.save();
    }

    // Davomat — activatedAt'dan kechagacha, bugun belgilanmagan (videoda belgilash uchun)
    for (const { group, cfg: g, teacher } of groups) {
      const members = await Student.find({ "groups.group": group._id, isDeleted: false });
      const dates = lessonDates(g.days, activatedAt, now);
      for (const date of dates) {
        const dUnix = dateStringToUnix(date);
        const records = [];
        for (const st of members) {
          const e = st.groups.find((x) => String(x.group) === String(group._id));
          if (e.joinedAt > dUnix) continue;
          if (e.status === "left" && e.leftAt && e.leftAt < dUnix) continue;
          const r = rnd();
          const status = r < 0.82 ? "present" : r < 0.92 ? "absent" : "excused";
          records.push({
            student: st._id, status,
            reason: status === "excused" ? pick(["Kasal", "Oilaviy sabab", "Musobaqa", "Shifokorga bordi"]) : "",
            late: status === "present" && rnd() < 0.1,
            source: status === "present" && rnd() < 0.3 ? "qr" : "manual",
          });
        }
        if (!records.length) continue;
        await Attendance.create({ client: client._id, center: center._id, group: group._id, date, records });
        summary.attendance++;

        // Baholar — kelganlarning ~60% iga
        for (const rec of records) {
          if (rec.status !== "present" || rnd() > 0.6) continue;
          await Grade.create({ client: client._id, center: center._id, group: group._id, student: rec.student, teacher: teacher._id, date, value: pick([3, 4, 4, 5, 5, 5]) });
          summary.grades++;
        }
      }
    }

    // Xarajatlar — 3 oy
    const EXP = [
      { title: "Ijara haqi", category: "rent", amount: cfg.name.startsWith("Chilonzor") ? 8000000 : 9500000 },
      { title: "Elektr va suv", category: "utilities", amount: 650000 },
      { title: "Internet (Uztelecom)", category: "utilities", amount: 250000 },
      { title: "Instagram reklama", category: "marketing", amount: 1200000 },
      { title: "Marker, doska, qog'oz", category: "other", amount: 180000 },
    ];
    for (let mi = 2; mi >= 0; mi--) {
      for (const e of EXP) {
        if (mi === 0 && e.category === "marketing" && rnd() < 0.5) continue;
        await Expense.create({ client: client._id, center: center._id, title: e.title, category: e.category, amount: e.amount + (e.category === "utilities" ? rint(-5, 5) * 10000 : 0), month: monthAgo(mi) });
        summary.expenses++;
      }
    }
    if (cfg.name.startsWith("Yunusobod")) {
      await Expense.create({ client: client._id, center: center._id, title: "Proyektor (Epson)", category: "equipment", amount: 4200000, month: monthAgo(1), note: "202-xona uchun" });
      await Expense.create({ client: client._id, center: center._id, title: "Konditsioner ta'miri", category: "repair", amount: 350000, month: thisMonth });
      summary.expenses += 2;
    } else {
      await Expense.create({ client: client._id, center: center._id, title: "Stol-stul (10 komplekt)", category: "equipment", amount: 3600000, month: monthAgo(2) });
      summary.expenses++;
    }

    // Oylik tranzaksiyalari
    const allStaff = [reception, ...teachers, assistant];
    for (let mi = 1; mi >= 0; mi--) {
      const month = monthAgo(mi);
      for (const s of allStaff) {
        if (rnd() < 0.6) {
          await SalaryTransaction.create({ client: client._id, center: center._id, staff: s._id, month, type: "advance", amount: pick([1000000, 1500000, 2000000]), note: "Avans", createdAt: dateStringToUnix(month + "-15") + 36000 });
          summary.salaryTx++;
        }
        if (rnd() < 0.3) {
          await SalaryTransaction.create({ client: client._id, center: center._id, staff: s._id, month, type: "withdrawal", amount: pick([200000, 300000, 500000]), note: "Oldindan pul oldi", createdAt: dateStringToUnix(month + "-0" + rint(3, 9)) + 40000 });
          summary.salaryTx++;
        }
        if (mi === 1 && rnd() < 0.25) {
          await SalaryTransaction.create({ client: client._id, center: center._id, staff: s._id, month, type: "bonus", amount: 500000, note: "Yaxshi natija uchun", createdAt: dateStringToUnix(month + "-28") + 40000 });
          summary.salaryTx++;
        }
      }
    }

    // O'quvchi lidlari
    const LEAD_STATUSES = ["new", "new", "new", "contacted", "contacted", "rejected"];
    for (let i = 0; i < 7; i++) {
      const gender = rnd() < 0.5 ? "m" : "f";
      await StudentLead.create({
        client: client._id, center: center._id, subject: pick(subjects)._id,
        fullName: fullName(gender), phone: `+99893${rint(1000000, 9999999)}`, parentPhone: rnd() < 0.5 ? parentPhone() : "",
        preferredDays: pick([["mon", "wed", "fri"], ["tue", "thu", "sat"], []]),
        preferredTime: pick(["any", "morning", "afternoon", "evening"]),
        level: pick(["", "Boshlang'ich", "O'rta", "A2"]),
        source: pick(["instagram", "telegram", "friend", "walkIn", "phone", "banner"]),
        note: pick(LEAD_NOTES), status: pick(LEAD_STATUSES),
        createdBy: { id: reception._id, kind: "staff", name: reception.name },
        createdAt: now - rint(0, 20) * 86400,
      });
      summary.leads++;
    }
  }

  console.log("SUMMARY", JSON.stringify(summary, null, 2));
  console.log("\nOwner:", PHONE, "/", PASSWORD);
  console.log("Hodimlar (parol hammasida", PASSWORD + "):");
  for (const c of CENTERS) {
    console.log(` ${c.name}: reception=${c.reception.login}, teachers=${c.teachers.map((t) => t.login).join(",")}, assistant=${c.assistant.login}`);
  }
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
