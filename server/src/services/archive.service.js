const Group = require("../models/Group");
const Student = require("../models/Student");
const Staff = require("../models/Staff");
const Room = require("../models/Room");
const Subject = require("../models/Subject");
const Center = require("../models/Center");
const TeachingPlan = require("../models/TeachingPlan");
const emit = require("../utils/emitter.util");
const BillingSetting = require("../models/BillingSetting");
const studentService = require("./student.service");
const groupService = require("./group.service");
const audit = require("../utils/audit.util");
const { restoreGroupEntries, restoreEntry, emitArchiveChanged } = require("../utils/archive.util");
const { formatDate } = require("../utils/date.util");
const { photoFor } = require("../utils/studentPhoto.util");

// Arxiv — CROSS-modul O'QISH qatlami (dashboard.service.js bilan bir xil
// falsafada): bu yerda o'z modeli yo'q, u Group/Student/Staff/Room/Subject
// hujjatlarining ARXIVLANGAN kesimini bitta sahifa uchun yig'ib beradi.
// Arxivlash AMALI esa har modulning O'Z zanjirida qoladi (CLAUDE.md
// "bitta domen = bitta routes/controller/service") — bu yerda faqat
// QAYTARISH (restore) bor, chunki qaytarish arxivning o'z amali.

const PAGE_SIZE = 50;

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildRegex = (search) => {
  const trimmed = (search || "").trim();
  return trimmed ? new RegExp(escapeRegex(trimmed), "i") : null;
};

// Xotirada sahifalash — arxiv ro'yxatlari kichik va bir qismi (guruh nomi,
// qarzdorlik) jonli hisoblangani uchun Mongo darajasida sahifalab bo'lmaydi.
const paginate = (rows, page) => {
  const pageNum = Math.max(1, Number(page) || 1);
  const total = rows.length;
  const start = (pageNum - 1) * PAGE_SIZE;
  return {
    data: rows.slice(start, start + PAGE_SIZE),
    meta: {
      page: pageNum,
      limit: PAGE_SIZE,
      total,
      totalPages: Math.ceil(total / PAGE_SIZE) || 1,
    },
  };
};

const centerNameMap = async (docs) => {
  const ids = [...new Set(docs.filter((d) => d.center).map((d) => String(d.center)))];
  if (!ids.length) return {};
  const centers = await Center.find({ _id: { $in: ids } }, { name: 1 });
  return Object.fromEntries(centers.map((c) => [String(c._id), c.name]));
};

// Guruh yorlig'i — qo'lda qo'yilgan nom bo'lmasa fan nomi + raqam
// (group.service.js DTO'si bilan bir xil mantiq, faqat matn ko'rinishida).
const groupLabel = (group, subjectName) => {
  if (group.name) return group.name;
  const no = group.activeId || group.pendingId;
  return `${subjectName || "?"}${no ? ` #${no}` : ""}`;
};

// Arxivlangan guruhlarni topadi. `center` — Staff kontekstida majburiy
// (tenantAuth `req.query.center`ni o'z filialiga almashtiradi).
const findArchivedGroups = async (clientId, center) => {
  const filter = { client: clientId, isDeleted: true };
  if (center) filter.center = center;
  return Group.find(filter).sort({ deletedAt: -1 });
};

// A'ZOLIK qatorlari (o'quvchi + guruh) — API_CONTRACT_archive.md §1:
// arxiv birligi o'quvchi HUJJATI emas, uning bitta guruhdagi a'zoligi.
// Sahifalanmagan to'liq ro'yxat: `students()` uni sahifalaydi, `counts()`
// esa arxivdagi JAMI qarzdorlikni shundan yig'adi (ikki xil so'rov ikki xil
// raqam bermasligi uchun yagona manba).
const studentEntryRows = async (clientId, { search = "", center = "" }) => {
  const elemMatch = { client: clientId, status: "archived" };
  if (center) elemMatch.center = center;

  const students = await Student.find({
    isDeleted: false,
    groups: { $elemMatch: elemMatch },
  }).sort({ createdAt: -1 });
  if (!students.length) return [];

  const entries = [];
  for (const student of students) {
    for (const entry of student.groups) {
      if (String(entry.client) !== String(clientId)) continue;
      if (center && String(entry.center) !== String(center)) continue;
      if (entry.status !== "archived") continue;
      entries.push({ student, entry });
    }
  }

  const groupIds = [...new Set(entries.map((e) => String(e.entry.group)))];
  // Arxivlangan guruh ham kerak — shuning uchun `isDeleted` filtri YO'Q.
  const groups = await Group.find({ _id: { $in: groupIds } }).select(
    // `isDeleted` ham kerak: guruhning O'ZI arxivda bo'lsa a'zolikni alohida
    // qaytarib bo'lmaydi (frontendda "Qaytarish" tugmasi yashiriladi).
    "name status activatedAt finishedAt center days subject activeId pendingId isDeleted",
  );
  const groupMap = Object.fromEntries(groups.map((g) => [String(g._id), g]));

  const [subjects, centers, billingDocs] = await Promise.all([
    Subject.find({ _id: { $in: [...new Set(groups.map((g) => String(g.subject)))] } }, { name: 1 }),
    centerNameMap(entries.map((e) => e.entry)),
    BillingSetting.find({
      center: { $in: [...new Set(groups.map((g) => String(g.center)))] },
    }).select("center cycleMode"),
  ]);
  const subjectMap = Object.fromEntries(subjects.map((s) => [String(s._id), s.name]));
  const cycleModeMap = Object.fromEntries(billingDocs.map((b) => [String(b.center), b.cycleMode]));

  const regex = buildRegex(search);
  const rows = entries
    .map(({ student, entry }) => {
      const group = groupMap[String(entry.group)];
      const subjectName = group ? subjectMap[String(group.subject)] || "" : "";
      const billing = studentService.computeBilling(
        entry,
        group,
        (group && cycleModeMap[String(group.center)]) || "anchor",
      );
      return {
        studentId: student._id,
        entryId: entry._id,
        fullName: student.fullName,
        phone: student.phone,
        photo: photoFor(student, clientId),
        groupId: entry.group,
        groupLabel: group ? groupLabel(group, subjectName) : "—",
        groupArchived: !!group?.isDeleted,
        centerName: centers[String(entry.center)] || "—",
        debt: billing.debt || 0,
        paidAmount: billing.paidAmount || 0,
        archivedWithGroup: !!entry.archivedWithGroup,
        archivedAt: entry.archivedAt || null,
        archivedDate: entry.archivedAt ? formatDate(entry.archivedAt) : "",
      };
    })
    .filter((r) => !regex || regex.test(r.fullName) || regex.test(r.phone) || regex.test(r.groupLabel))
    .sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0));
  return rows;
};

module.exports = {
  // ─── Ro'yxatlar ────────────────────────────────────────────────────────
  groups: async (clientId, { page = 1, search = "", center = "" }) => {
    const groups = await findArchivedGroups(clientId, center);
    if (!groups.length) return paginate([], page);

    const [subjects, teachers, rooms, centers] = await Promise.all([
      Subject.find({ _id: { $in: [...new Set(groups.map((g) => String(g.subject)))] } }, { name: 1 }),
      Staff.find(
        { _id: { $in: [...new Set(groups.filter((g) => g.teacher).map((g) => String(g.teacher)))] } },
        { name: 1 },
      ),
      Room.find(
        { _id: { $in: [...new Set(groups.filter((g) => g.room).map((g) => String(g.room)))] } },
        { name: 1 },
      ),
      centerNameMap(groups),
    ]);
    const subjectMap = Object.fromEntries(subjects.map((s) => [String(s._id), s.name]));
    const teacherMap = Object.fromEntries(teachers.map((s) => [String(s._id), s.name]));
    const roomMap = Object.fromEntries(rooms.map((r) => [String(r._id), r.name]));

    // Guruhdagi arxivlangan a'zoliklar (o'quvchi soni + qarzdorlik) —
    // bitta so'rovda, guruh boshiga alohida so'rov qilinmaydi.
    const groupIds = groups.map((g) => g._id);
    const students = await Student.find(
      { "groups.group": { $in: groupIds }, isDeleted: false },
      { groups: 1 },
    );

    const billingDocs = await BillingSetting.find({
      center: { $in: [...new Set(groups.map((g) => String(g.center)))] },
    }).select("center cycleMode");
    const cycleModeMap = Object.fromEntries(billingDocs.map((b) => [String(b.center), b.cycleMode]));
    const groupMap = Object.fromEntries(groups.map((g) => [String(g._id), g]));

    const stats = {};
    for (const student of students) {
      for (const entry of student.groups) {
        const group = groupMap[String(entry.group)];
        if (!group) continue;
        if (String(entry.client) !== String(clientId)) continue;
        if (entry.status !== "archived") continue;
        const key = String(entry.group);
        stats[key] ||= { count: 0, debt: 0 };
        stats[key].count += 1;
        // Qarzdorlik hujjatda saqlanmaydi — YAGONA formula orqali jonli
        // hisoblanadi (student.service.js#computeBilling), shu bilan
        // Arxivdagi raqam O'quvchi kartochkasidagi bilan bir xil chiqadi.
        const billing = studentService.computeBilling(
          entry,
          group,
          cycleModeMap[String(group.center)] || "anchor",
        );
        stats[key].debt += billing.debt || 0;
      }
    }

    const regex = buildRegex(search);
    const rows = groups
      .map((g) => {
        const subjectName = subjectMap[String(g.subject)] || "";
        const stat = stats[String(g._id)] || { count: 0, debt: 0 };
        return {
          _id: g._id,
          label: groupLabel(g, subjectName),
          subjectName: subjectName || "—",
          teacherName: g.teacher ? teacherMap[String(g.teacher)] || "—" : "—",
          roomName: g.room ? roomMap[String(g.room)] || "—" : "—",
          centerName: centers[String(g.center)] || "—",
          status: g.status,
          studentsCount: stat.count,
          debt: stat.debt,
          archivedAt: g.deletedAt || null,
          archivedDate: g.deletedAt ? formatDate(g.deletedAt) : "",
          // Xom ID'lar — restore vaqt-konflikt chiqsa GroupScheduleDialog'ga
          // (client/src/pages/Archive/index.jsx) shu maydonlar bilan
          // uzatiladi, ustunlarda ko'rsatilmaydi.
          center: g.center,
          teacher: g.teacher || "",
          assistant: g.assistant || "",
          room: g.room || "",
          days: g.days || [],
          startTime: g.startTime || "",
          endTime: g.endTime || "",
        };
      })
      .filter((r) => !regex || regex.test(r.label) || regex.test(r.teacherName));

    return paginate(rows, page);
  },

  students: async (clientId, { page = 1, search = "", center = "" }) => {
    return paginate(await studentEntryRows(clientId, { search, center }), page);
  },

  staff: async (clientId, { page = 1, search = "" }) => {
    const list = await Staff.find({ client: clientId, isDeleted: true })
      .sort({ deletedAt: -1 })
      .select("name login role center deletedAt createdAt blocked");
    const centers = await centerNameMap(list);

    const regex = buildRegex(search);
    const rows = list
      .map((s) => ({
        _id: s._id,
        name: s.name,
        login: s.login,
        role: s.role,
        blocked: !!s.blocked,
        centerName: centers[String(s.center)] || "—",
        archivedAt: s.deletedAt || null,
        archivedDate: s.deletedAt ? formatDate(s.deletedAt) : "",
      }))
      .filter((r) => !regex || regex.test(r.name) || regex.test(r.login));

    return paginate(rows, page);
  },

  rooms: async (clientId, { page = 1, search = "", center = "" }) => {
    const filter = { client: clientId, isDeleted: true };
    if (center) filter.center = center;
    const list = await Room.find(filter).sort({ deletedAt: -1 });
    const centers = await centerNameMap(list);

    const regex = buildRegex(search);
    const rows = list
      .map((r) => ({
        _id: r._id,
        name: r.name,
        capacity: r.capacity,
        centerName: centers[String(r.center)] || "—",
        archivedAt: r.deletedAt || null,
        archivedDate: r.deletedAt ? formatDate(r.deletedAt) : "",
      }))
      .filter((r) => !regex || regex.test(r.name));

    return paginate(rows, page);
  },

  subjects: async (clientId, { page = 1, search = "", center = "" }) => {
    const filter = { client: clientId, isDeleted: true };
    if (center) filter.center = center;
    const list = await Subject.find(filter).sort({ deletedAt: -1 });
    const centers = await centerNameMap(list);

    const regex = buildRegex(search);
    const rows = list
      .map((s) => ({
        _id: s._id,
        name: s.name,
        price: s.price,
        durationMonths: s.durationMonths,
        centerName: centers[String(s.center)] || "—",
        archivedAt: s.deletedAt || null,
        archivedDate: s.deletedAt ? formatDate(s.deletedAt) : "",
      }))
      .filter((r) => !regex || regex.test(r.name));

    return paginate(rows, page);
  },

  // O'qituvchilarning arxivlangan "Dars rejalarim" shablonlari. Qidiruv —
  // reja nomi yoki o'qituvchi ismi bo'yicha.
  teachingPlans: async (clientId, { page = 1, search = "", center = "" }) => {
    const filter = { client: clientId, isDeleted: true };
    if (center) filter.center = center;
    const list = await TeachingPlan.find(filter, {
      title: 1, staff: 1, subject: 1, center: 1, modules: 1, deletedAt: 1,
    })
      .sort({ deletedAt: -1 })
      .lean();

    const [centers, teachers, subjects] = await Promise.all([
      centerNameMap(list),
      Staff.find({ _id: { $in: [...new Set(list.map((p) => String(p.staff)))] } }, { name: 1 }).lean(),
      Subject.find({ _id: { $in: [...new Set(list.map((p) => String(p.subject)))] } }, { name: 1 }).lean(),
    ]);
    const teacherMap = Object.fromEntries(teachers.map((x) => [String(x._id), x.name]));
    const subjectMap = Object.fromEntries(subjects.map((x) => [String(x._id), x.name]));

    const regex = buildRegex(search);
    const rows = list
      .map((p) => ({
        _id: p._id,
        title: p.title,
        teacherName: teacherMap[String(p.staff)] || "—",
        subjectName: subjectMap[String(p.subject)] || "—",
        moduleCount: (p.modules || []).length,
        lessonCount: (p.modules || []).reduce((sum, m) => sum + (m.lessons?.length || 0), 0),
        centerName: centers[String(p.center)] || "—",
        archivedAt: p.deletedAt || null,
        archivedDate: p.deletedAt ? formatDate(p.deletedAt) : "",
      }))
      .filter((r) => !regex || regex.test(r.title) || regex.test(r.teacherName));

    return paginate(rows, page);
  },

  // Tab'lardagi sanoqlar + arxivdagi JAMI qarzdorlik (bu raqam Dashboard
  // "Umumiy qarzdorlik"iga KIRMAYDI — API_CONTRACT_archive.md §3).
  // Tab'lardagi sanoqlar + arxivdagi JAMI qarzdorlik. Bu raqam Dashboard
  // "Umumiy qarzdorlik"iga KIRMAYDI — arxivdagi qarz faqat shu yerda
  // ko'rsatiladi (API_CONTRACT_archive.md §3).
  counts: async (clientId, { center = "", includeStaff = false }) => {
    const scoped = () => ({
      client: clientId,
      isDeleted: true,
      ...(center ? { center } : {}),
    });

    const [groups, rooms, subjects, staff, entryRows, teachingPlans] = await Promise.all([
      Group.countDocuments(scoped()),
      Room.countDocuments(scoped()),
      Subject.countDocuments(scoped()),
      // Hodim arxivi FAQAT Boshliqqa ko'rinadi — Resepshin uchun 0 qaytadi
      // va tab umuman chizilmaydi.
      includeStaff ? Staff.countDocuments({ client: clientId, isDeleted: true }) : 0,
      studentEntryRows(clientId, { center }),
      TeachingPlan.countDocuments(scoped()),
    ]);

    return {
      groups,
      students: entryRows.length,
      staff,
      rooms,
      subjects,
      teachingPlans,
      totalDebt: entryRows.reduce((sum, r) => sum + r.debt, 0),
    };
  },

  // ─── Qaytarish ─────────────────────────────────────────────────────────
  // Guruh arxivda turgan payt uning eski xona+kun+vaqt sloti checkRoomConflict
  // filtridan chiqib ketadi (status:"archived" candidates ro'yxatiga
  // kirmaydi — group.service.js), shuning uchun o'sha slot boshqa guruhga
  // berilgan bo'lishi mumkin. Qaytarishdan oldin xuddi shu tekshiruv qayta
  // ishlatiladi; band bo'lsa `override` orqali kelgan yangi xona/kun/vaqt
  // bilan qaytarish so'raladi (frontend GroupScheduleDialog shu formani
  // ishlatib qayta yuboradi).
  restoreGroup: async (clientId, id, override = {}, actor = null) => {
    const group = await Group.findOne({ _id: id, client: clientId, isDeleted: true });
    if (!group) throw new Error("archive.notFound");

    const { roomId, days, startTime, endTime } = override;
    const nextDays = days || group.days;
    const nextStartTime = startTime !== undefined ? startTime : group.startTime;
    const nextEndTime = endTime !== undefined ? endTime : group.endTime;
    const room = roomId
      ? await groupService.validateRoom(clientId, group.center, roomId)
      : await Room.findOne({ _id: group.room, isDeleted: false });

    if (room && nextDays?.length && nextStartTime && nextEndTime) {
      await groupService.checkRoomConflict(
        clientId,
        group.center,
        room,
        nextDays,
        nextStartTime,
        nextEndTime,
        group._id,
      );
    }

    if (roomId) group.room = room._id;
    if (days) group.days = days;
    if (startTime !== undefined) group.startTime = startTime;
    if (endTime !== undefined) group.endTime = endTime;

    group.isDeleted = false;
    group.deletedAt = null;
    await group.save();

    // Faqat guruh bilan BIRGA arxivlangan a'zoliklar tiklanadi — qo'lda
    // arxivlangani arxivda qoladi (archive.util.js).
    const entriesRestored = await restoreGroupEntries(group._id);

    emitArchiveChanged(clientId, group.center, "group", group._id, "restored");
    // API_CONTRACT_archive.md §6 — guruh qaytarilganda `group:changed` ham
    // chiqishi kerak, chunki xona/kun/vaqt o'zgargan bo'lishi mumkin
    // (Groups ro'yxati, /schedule va h.k. shu eventni tinglaydi).
    groupService.emitGroupChanged(clientId, group, "restored");
    void audit.log({
      actor,
      client: clientId,
      center: group.center,
      action: "group:restored",
      entity: { type: "group", id: group._id, label: group.name || "" },
      meta: { entriesRestored },
    });

    return true;
  },

  restoreStudentEntry: async (clientId, studentId, entryId, actor = null) => {
    const student = await Student.findOne({ _id: studentId, isDeleted: false });
    if (!student) throw new Error("student.notFound");

    const entry = student.groups.id(entryId);
    if (!entry || String(entry.client) !== String(clientId)) {
      throw new Error("student.groupEntryNotFound");
    }
    if (entry.status !== "archived") throw new Error("archive.notArchived");

    // Guruhning o'zi hali arxivda bo'lsa a'zolikni tiklash mantiqsiz —
    // avval guruh qaytarilishi kerak (u a'zolikni ham o'zi tiklaydi).
    const group = await Group.findById(entry.group).select("isDeleted maxStudents");
    if (group?.isDeleted) throw new Error("archive.groupStillArchived");

    restoreEntry(entry);
    await student.save();

    // Arxivdan qaytarish ham guruhni limitdan oshirishi mumkin —
    // student.service.js `create()` dagi kabi limit yangi songa ko'tariladi
    // (`maxStudents` mo'ljal, to'siq emas).
    if (group && group.maxStudents != null && entry.status === "active") {
      const activeInGroup = await Student.countDocuments({
        isDeleted: false,
        groups: { $elemMatch: { group: group._id, status: "active" } },
      });
      if (activeInGroup > group.maxStudents) {
        group.maxStudents = activeInGroup;
        await group.save();
      }
    }

    emitArchiveChanged(clientId, entry.center, "student", student._id, "restored");
    void audit.log({
      actor,
      client: clientId,
      center: entry.center,
      action: "student:restored",
      entity: { type: "student", id: student._id, label: student.fullName },
      meta: { groupEntryId: String(entryId), group: String(entry.group) },
    });

    return true;
  },

  restoreRoom: async (clientId, id, actor = null) => {
    const room = await Room.findOne({ _id: id, client: clientId, isDeleted: true });
    if (!room) throw new Error("archive.notFound");

    room.isDeleted = false;
    room.deletedAt = null;
    await room.save();

    emitArchiveChanged(clientId, room.center, "room", room._id, "restored");
    void audit.log({
      actor,
      client: clientId,
      center: room.center,
      action: "room:restored",
      entity: { type: "room", id: room._id, label: room.name },
    });

    return true;
  },

  restoreSubject: async (clientId, id, actor = null) => {
    const subject = await Subject.findOne({ _id: id, client: clientId, isDeleted: true });
    if (!subject) throw new Error("archive.notFound");

    subject.isDeleted = false;
    subject.deletedAt = null;
    await subject.save();

    emitArchiveChanged(clientId, subject.center, "subject", subject._id, "restored");
    void audit.log({
      actor,
      client: clientId,
      center: subject.center,
      action: "subject:restored",
      entity: { type: "subject", id: subject._id, label: subject.name },
    });

    return true;
  },

  restoreTeachingPlan: async (clientId, id, actor = null) => {
    const plan = await TeachingPlan.findOne({ _id: id, client: clientId, isDeleted: true });
    if (!plan) throw new Error("archive.notFound");

    plan.isDeleted = false;
    plan.deletedAt = null;
    await plan.save();

    emitArchiveChanged(clientId, plan.center, "teachingPlan", plan._id, "restored");
    // Egasi (o'qituvchi) ochiq "Dars rejalarim" sahifasida darhol ko'radi.
    emit(`user:${plan.staff}`, "teachingPlan:changed", { planId: String(plan._id) });
    void audit.log({
      actor,
      client: clientId,
      center: plan.center,
      action: "teachingPlan:restored",
      entity: { type: "teachingPlan", id: plan._id, label: plan.title },
    });

    return true;
  },

  // Hodim login'i faqat ARXIVLANMAGANLAR orasida unique (Staff.js partial
  // index) — arxivdan qaytarayotganda o'sha login boshqa faol hodimga
  // berilgan bo'lishi mumkin, shuning uchun oldindan tekshiriladi.
  restoreStaff: async (clientId, id, actor = null) => {
    const staff = await Staff.findOne({ _id: id, client: clientId, isDeleted: true });
    if (!staff) throw new Error("archive.notFound");

    const loginTaken = await Staff.findOne({ client: clientId, login: staff.login, isDeleted: false }).select("_id");
    if (loginTaken) throw new Error("staff.loginTaken");

    staff.isDeleted = false;
    staff.deletedAt = null;
    await staff.save();

    emitArchiveChanged(clientId, staff.center, "staff", staff._id, "restored");
    void audit.log({
      actor,
      client: clientId,
      center: staff.center,
      action: "staff:restored",
      entity: { type: "staff", id: staff._id, label: staff.name },
    });

    return true;
  },
};
