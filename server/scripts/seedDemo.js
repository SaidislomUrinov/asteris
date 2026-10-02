require("dotenv").config();
const mongoose = require("mongoose");
const env = require("../src/configs/env.config");
const { getHash } = require("../src/utils/hash.util");
const { getNow, addMonths, formatMonth } = require("../src/utils/date.util");

const Client = require("../src/models/Client");
const Tariff = require("../src/models/Tariff");
const Subscription = require("../src/models/Subscription");
const Center = require("../src/models/Center");
const Room = require("../src/models/Room");
const Subject = require("../src/models/Subject");
const Staff = require("../src/models/Staff");
const Group = require("../src/models/Group");
const Student = require("../src/models/Student");
const Grade = require("../src/models/Grade");
const Expense = require("../src/models/Expense");
const SalaryTransaction = require("../src/models/SalaryTransaction");
const Counter = require("../src/models/Counter");

const PHONE = "+998931042255";
const PASSWORD = "claude-test-pass";

const run = async () => {
  await mongoose.connect(env.MONGO_URI);
  console.log("connected");

  // --- Client Owner ---
  let client = await Client.findOne({ phone: PHONE, isDeleted: false });
  if (!client) {
    client = await Client.create({
      name: "Saidislom",
      phone: PHONE,
      password: await getHash(PASSWORD),
      email: "saidislom@wenet.uz",
    });
  } else {
    client.password = await getHash(PASSWORD);
    client.blocked = false;
    await client.save();
  }

  // --- Tariff (generous demo tariff) ---
  let tariff = await Tariff.findOne({ name: "Demo Premium", isDeleted: false });
  if (!tariff) {
    tariff = await Tariff.create({
      name: "Demo Premium",
      price: 990000,
      trialDays: 0,
      studentLimit: -1,
      centerLimit: 5,
      teacherLimit: -1,
      receptionLimit: -1,
      allowedPermissions: [
        "excel.export",
        "telegram.notifications",
        "teacher.notifications",
        "teacher.performance",
        "staff.salary.advance",
        "staff.salary.percentage",
        "staff.salary.fixed",
        "staff.salary.perGroup",
        "staff.bonus",
        "student.rate",
        "student.transfer",
        "attendance.qr",
        "attendance.report",
        "room.control",
        "lesson.planning",
        "homework.manage",
        "certificate.manage",
        "receipt.manage",
        "finance.expense",
        "finance.refund",
        "finance.report",
      ],
    });
  }

  // --- Active subscription ---
  const now = getNow();
  const sub = await Subscription.create({
    client: client._id,
    tariff: tariff._id,
    tariffSnapshot: {
      name: tariff.name,
      price: tariff.price,
      studentLimit: tariff.studentLimit,
      centerLimit: tariff.centerLimit,
      teacherLimit: tariff.teacherLimit,
      receptionLimit: tariff.receptionLimit,
      allowedPermissions: tariff.allowedPermissions,
    },
    price: tariff.price,
    startDate: now,
    endDate: addMonths(now, 6),
    status: "active",
    source: "admin",
  });
  client.subscription = sub._id;
  await client.save();

  // --- Centers ---
  const centersData = [
    { name: "Wenet Learning Center — Chilonzor", slogan: "Zamonaviy ta'lim markazi" },
    { name: "Wenet Learning Center — Yunusobod", slogan: "Kelajak shu yerdan boshlanadi" },
  ];
  const centers = [];
  for (const c of centersData) {
    const center = await Center.create({ client: client._id, name: c.name, slogan: c.slogan, status: "active" });
    centers.push(center);
  }

  const subjectNames = ["Matematika", "Ingliz tili", "Fizika", "Kimyo"];
  const roomNames = ["101-xona", "102-xona", "Katta zal"];

  const summary = {
    centers: centers.length,
    subjects: 0,
    rooms: 0,
    staff: 0,
    groups: 0,
    students: 0,
    grades: 0,
    payments: 0,
    refunds: 0,
    expenses: 0,
    salaryTx: 0,
  };

  const allStudents = [];
  let studentPhoneSeq = 900000001;

  for (let ci = 0; ci < centers.length; ci++) {
    const center = centers[ci];

    // Subjects
    const subjects = [];
    for (const name of subjectNames.slice(0, 3 + ci)) {
      const subj = await Subject.create({
        client: client._id,
        center: center._id,
        name,
        price: 350000 + Math.floor(Math.random() * 5) * 50000,
        durationMonths: 1,
      });
      subjects.push(subj);
      summary.subjects++;
    }

    // Rooms
    const rooms = [];
    for (const name of roomNames) {
      const room = await Room.create({ client: client._id, center: center._id, name, capacity: 15, status: "active" });
      rooms.push(room);
      summary.rooms++;
    }

    // Staff: manager (permissions: all), 2 teachers, 1 reception
    const manager = await Staff.create({
      client: client._id,
      center: center._id,
      name: `Menejer ${ci + 1}-markaz`,
      login: `manager${ci + 1}`,
      password: await getHash("claude-test-pass"),
      role: "reception",
      permissions: ["all"],
    });
    summary.staff++;

    const reception = await Staff.create({
      client: client._id,
      center: center._id,
      name: `Resepshin ${ci + 1}-markaz`,
      login: `reception${ci + 1}`,
      password: await getHash("claude-test-pass"),
      role: "reception",
      permissions: [
        "group:view", "group:create", "group:update",
        "student:view", "student:create", "student:update",
        "payment:view", "payment:create", "payment:refund",
        "attendance:view", "attendance:create",
        "center:view",
      ],
    });
    summary.staff++;

    const teachers = [];
    for (let ti = 0; ti < 2; ti++) {
      const t = await Staff.create({
        client: client._id,
        center: center._id,
        name: `O'qituvchi ${ci + 1}.${ti + 1}`,
        login: `teacher${ci + 1}${ti + 1}`,
        password: await getHash("claude-test-pass"),
        role: "teacher",
        permissions: ["group:view", "student:view", "attendance:view", "attendance:create", "attendance:update", "lesson:view", "lesson:create", "lesson:update", "staff.salary.percentage"],
        subjects: [subjects[ti % subjects.length]._id],
        salaryValue: 35,
      });
      teachers.push(t);
      summary.staff++;
    }

    // Groups: one per subject
    const groups = [];
    for (let si = 0; si < subjects.length; si++) {
      const pendingId = await Counter.next(`group_pending_${client.clientId}`);
      const activeId = await Counter.next(`group_active_${client.clientId}`);
      const group = await Group.create({
        client: client._id,
        center: center._id,
        subject: subjects[si]._id,
        teacher: teachers[si % teachers.length]._id,
        room: rooms[si % rooms.length]._id,
        days: si % 2 === 0 ? ["mon", "wed", "fri"] : ["tue", "thu", "sat"],
        startTime: "15:00",
        endTime: "16:30",
        maxStudents: 15,
        status: "active",
        pendingId,
        activeId,
        activatedAt: now - 60 * 24 * 3600,
      });
      groups.push({ group, subject: subjects[si] });
      summary.groups++;
    }

    // Students: 6-7 per center
    const studentCount = 6 + ci;
    for (let sIdx = 0; sIdx < studentCount; sIdx++) {
      const phone = `+998${studentPhoneSeq++}`;
      const groupEntries = [];
      const enrollCount = 1 + (sIdx % 2); // some enrolled in 2 groups
      const chosenGroups = [];
      for (let g = 0; g < enrollCount; g++) {
        chosenGroups.push(groups[(sIdx + g) % groups.length]);
      }
      for (const { group, subject } of chosenGroups) {
        const price = subject.price;
        const payments = [];
        const paidFull = sIdx % 3 !== 0; // some students have debt
        const firstPay = paidFull ? price : Math.floor(price * 0.5);
        payments.push({
          amount: firstPay,
          type: sIdx % 2 === 0 ? "cash" : "card",
          status: "paid",
          note: "Oylik to'lov",
          forMonth: formatMonth(now),
          collectedBy: reception._id,
          collectedByKind: "staff",
          date: now - 10 * 24 * 3600,
        });
        summary.payments++;

        if (sIdx % 5 === 0) {
          // add a refund record
          payments.push({
            amount: Math.floor(firstPay * 0.2),
            type: "cash",
            status: "refunded",
            note: "Qisman qaytarish",
            forMonth: formatMonth(now),
            collectedBy: reception._id,
            collectedByKind: "staff",
            date: now - 5 * 24 * 3600,
          });
          summary.refunds++;
        }

        groupEntries.push({
          group: group._id,
          center: center._id,
          client: client._id,
          subject: subject._id,
          price,
          priceHistory: [{ price, from: now - 60 * 24 * 3600 }],
          status: "active",
          joinedAt: now - 60 * 24 * 3600,
          payments,
        });
      }

      const student = await Student.create({
        phone,
        fullName: `O'quvchi ${ci + 1}-${sIdx + 1}`,
        parentPhone: `+998${900000000 + Math.floor(Math.random() * 90000000)}`,
        groups: groupEntries,
      });
      allStudents.push({ student, groups: chosenGroups });
      summary.students++;

      // Grades for this student in its groups
      for (const { group } of chosenGroups) {
        for (let d = 0; d < 3; d++) {
          await Grade.create({
            client: client._id,
            center: center._id,
            group: group.group ? group.group._id : group._id,
            student: student._id,
            teacher: teachers[0]._id,
            date: require("moment-timezone").unix(now - d * 2 * 24 * 3600).tz("Asia/Tashkent").format("YYYY-MM-DD"),
            value: 3 + (d % 3),
          });
          summary.grades++;
        }
      }
    }

    // Expenses
    const expenseTitles = [
      { title: "Ijaraga to'lov", category: "rent", amount: 4500000 },
      { title: "Kommunal xizmatlar", category: "utilities", amount: 800000 },
      { title: "Reklama", category: "marketing", amount: 600000 },
    ];
    for (const e of expenseTitles) {
      await Expense.create({
        client: client._id,
        center: center._id,
        title: e.title,
        category: e.category,
        amount: e.amount,
        month: formatMonth(now),
      });
      summary.expenses++;
    }

    // Salary transactions (advance/withdrawal/bonus) — "berilgan oyliklar"
    const allStaffForSalary = [manager, reception, ...teachers];
    for (let idx = 0; idx < allStaffForSalary.length; idx++) {
      const s = allStaffForSalary[idx];
      await SalaryTransaction.create({
        client: client._id,
        center: center._id,
        staff: s._id,
        month: formatMonth(now),
        type: "advance",
        amount: 1500000,
        note: "Oylik avans",
      });
      summary.salaryTx++;
      if (idx % 2 === 0) {
        await SalaryTransaction.create({
          client: client._id,
          center: center._id,
          staff: s._id,
          month: formatMonth(now),
          type: "withdrawal",
          amount: 300000,
          note: "Oldindan pul olish",
        });
        summary.salaryTx++;
      }
    }
  }

  console.log("SUMMARY", JSON.stringify(summary, null, 2));
  console.log("Client Owner id:", client._id.toString(), "phone:", client.phone);

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
