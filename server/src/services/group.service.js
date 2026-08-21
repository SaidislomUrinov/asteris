const { Types } = require("mongoose");
const Group = require("../models/Group");
const Syllabus = require("../models/Syllabus");
const Center = require("../models/Center");
const Subject = require("../models/Subject");
const Staff = require("../models/Staff");
const Room = require("../models/Room");
const Student = require("../models/Student");
const Counter = require("../models/Counter");
const { getNow, dateStringToUnix } = require("../utils/date.util");
const rescheduleDraft = require("../utils/rescheduleDraft.util");
const syllabusProgress = require("../utils/syllabusProgress.util");
const emit = require("../utils/emitter.util");

const PAGE_SIZE = 50;

// "mon,wed" → ["mon","wed"]. Notanish kodlar jimgina tashlanadi (xato emas) —
// API_CONTRACT_group_days_filter.md §1. Bo'sh natija = filtr qo'llanmaydi.
const parseDays = (days) => {
  if (!days) return [];
  const list = String(days)
    .split(",")
    .map((d) => d.trim())
    .filter((d) => Group.DAYS.includes(d));
  return [...new Set(list)];
};

const DTO = (data, studentsCount = 0, syllabus = null, roomName = null, subjectName = null) => ({
  _id: data?._id,
  client: data?.client,
  center: data?.center,
  subject: data?.subject,
  subjectName,
  teacher: data?.teacher,
  assistant: data?.assistant,
  room: data?.room,
  roomName,
  days: data?.days,
  startTime: data?.startTime,
  endTime: data?.endTime,
  maxStudents: data?.maxStudents,
  status: data?.status,
  pendingId: data?.pendingId,
  activeId: data?.activeId,
  activatedAt: data?.activatedAt,
  activatedDate: data?.activatedDate,
  finishedAt: data?.finishedAt,
  studentsCount,
  lessonOffset: data?.lessonOffset || 0,
  // Kurs dasturi qisqacha holati (GroupCard chipi) — dastur yo'q bo'lsa null.
  syllabus,
  date: data?.date,
  lastUpdate: data?.lastUpdate,
});

// Guruhlar ro'yxati uchun kurs dasturi holati — BITTA aggregate + BITTA
// davomat aggregate'i (guruh boshiga so'rov QILINMAYDI, aks holda 50 ta
// guruhli sahifada 100 ta qo'shimcha so'rov bo'lardi).
//
// `moduleNo`/`lessonNo` — 1 dan boshlangan JORIY o'rin: keyingi o'tiladigan
// dars. Dastur tugagan bo'lsa oxirgi modul/oxirgi dars ko'rsatiladi.
const getSyllabusMap = async (clientId, groups) => {
  if (!groups.length) return {};

  const groupIds = groups.map((g) => g._id);
  const [rows, doneMap] = await Promise.all([
    Syllabus.aggregate([
      {
        $match: {
          client: new Types.ObjectId(String(clientId)),
          group: { $in: groupIds.map((id) => new Types.ObjectId(String(id))) },
          isDeleted: false,
        },
      },
      {
        $project: {
          group: 1,
          moduleCount: { $size: { $ifNull: ["$modules", []] } },
          // Har modulning dars soni — flatten qilmasdan, joriy darsning
          // qaysi modulga tushishini shu ro'yxatdan hisoblaymiz.
          lessonCounts: {
            $map: {
              input: { $ifNull: ["$modules", []] },
              as: "m",
              in: { $size: { $ifNull: ["$$m.lessons", []] } },
            },
          },
        },
      },
    ]),
    syllabusProgress.countDoneMap(clientId, groupIds),
  ]);

  const offsetMap = Object.fromEntries(groups.map((g) => [String(g._id), g.lessonOffset || 0]));
  const map = {};

  for (const row of rows) {
    const key = String(row.group);
    const totalLessons = row.lessonCounts.reduce((sum, n) => sum + n, 0);
    if (!totalLessons) continue;

    const doneCount = (doneMap[key] || 0) + (offsetMap[key] || 0);
    const finished = doneCount >= totalLessons;
    // Joriy dars raqami: tugamagan bo'lsa keyingisi, tugagan bo'lsa oxirgisi.
    const lessonNo = finished ? totalLessons : doneCount + 1;

    // `lessonNo` qaysi modulga tushishini modul dars sonlari bo'yicha yurib topamiz.
    let remaining = lessonNo;
    let moduleNo = 1;
    for (let i = 0; i < row.lessonCounts.length; i += 1) {
      if (remaining <= row.lessonCounts[i]) {
        moduleNo = i + 1;
        break;
      }
      remaining -= row.lessonCounts[i];
      moduleNo = i + 1;
    }

    map[key] = {
      moduleNo,
      moduleCount: row.moduleCount,
      lessonNo,
      totalLessons,
      finished,
    };
  }

  return map;
};

// Bir nechta guruh uchun bitta so'rovda studentsCount xaritasini tuzadi
// (Student.groups[] massividan) — API_CONTRACT.md §5 "list" bo'limi.
const getStudentsCountMap = async (groupIds) => {
  if (!groupIds.length) return {};
  const rows = await Student.aggregate([
    { $match: { "groups.group": { $in: groupIds } } },
    { $unwind: "$groups" },
    { $match: { "groups.group": { $in: groupIds }, "groups.status": "active" } },
    { $group: { _id: "$groups.group", count: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map((r) => [String(r._id), r.count]));
};

// Xona nomini har bir guruhga biriktiradi — Room CRUD `room:view` ruxsati
// bilan himoyalangan (reception/menejer uchun), lekin o'qituvchi o'z darsi
// qaysi xonada bo'lishini bilishi shart, shu sabab nom shu yerda, DTO orqali,
// permission tekshirilmasdan biriktiriladi (faqat NOM, Room CRUD emas).
const getRoomNameMap = async (groups) => {
  const roomIds = [...new Set(groups.filter((g) => g.room).map((g) => String(g.room)))];
  if (!roomIds.length) return {};
  const rooms = await Room.find({ _id: { $in: roomIds } }).select("name");
  return Object.fromEntries(rooms.map((r) => [String(r._id), r.name]));
};

// Fan nomini har bir guruhga biriktiradi — Fan CRUD `subject:view` ruxsati
// bilan himoyalangan (reception/menejer uchun), lekin o'qituvchi/yordamchi o'z
// guruhi qaysi fandan ekanini bilishi shart, shu sabab nom shu yerda, DTO orqali,
// permission tekshirilmasdan biriktiriladi (faqat NOM, Subject CRUD emas).
const getSubjectNameMap = async (groups) => {
  const subjectIds = [...new Set(groups.filter((g) => g.subject).map((g) => String(g.subject)))];
  if (!subjectIds.length) return {};
  const subjects = await Subject.find({ _id: { $in: subjectIds } }).select("name");
  return Object.fromEntries(subjects.map((s) => [String(s._id), s.name]));
};

const validateCenterSubject = async (clientId, centerId, subjectId) => {
  const center = await Center.findOne({ _id: centerId, client: clientId, isDeleted: false });
  if (!center) throw new Error("center.notFound");

  const subject = await Subject.findOne({
    _id: subjectId,
    client: clientId,
    center: center._id,
    isDeleted: false,
  });
  if (!subject) throw new Error("subject.notFound");

  return { center, subject };
};

const validateTeacher = async (clientId, centerId, teacherId) => {
  if (!teacherId) return null;
  const teacher = await Staff.findOne({
    _id: teacherId,
    client: clientId,
    center: centerId,
    role: "teacher",
    isDeleted: false,
  });
  if (!teacher) throw new Error("group.teacherNotFound");
  return teacher;
};

// Yordamchi o'qituvchi — IXTIYORIY, `assistant` rolidagi hodim bo'lishi shart.
const validateAssistant = async (clientId, centerId, assistantId) => {
  if (!assistantId) return null;
  const assistant = await Staff.findOne({
    _id: assistantId,
    client: clientId,
    center: centerId,
    role: "assistant",
    isDeleted: false,
  });
  if (!assistant) throw new Error("group.assistantNotFound");
  return assistant;
};

const validateRoom = async (clientId, centerId, roomId) => {
  if (!roomId) return null;
  const room = await Room.findOne({
    _id: roomId,
    client: clientId,
    center: centerId,
    isDeleted: false,
  });
  if (!room) throw new Error("room.notFound");
  return room;
};

const validateDays = (days) => {
  if (days && days.some((d) => !Group.DAYS.includes(d))) throw new Error("group.invalidDays");
};

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

// Ikki vaqt oralig'i kesishadimi ("HH:mm" — "HH:mm").
const timesOverlap = (aStart, aEnd, bStart, bEnd) =>
  toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd);

// Bitta xonaga bir vaqtning o'zida ikkita guruh tushib qolmasligi uchun —
// shu xonadagi boshqa tugallanmagan (pending/active) guruhlar orasidan kun +
// soat kesishganini tekshiradi. Faqat room+days+startTime+endTime hammasi
// birga belgilanganda chaqiriladi (create'da ixtiyoriy, activate'da majburiy).
const checkRoomConflict = async (clientId, centerId, room, days, startTime, endTime, excludeGroupId) => {
  if (!room || !days?.length || !startTime || !endTime) return;

  const candidates = await Group.find({
    client: clientId,
    center: centerId,
    room: room._id,
    isDeleted: false,
    status: { $in: ["pending", "active"] },
    ...(excludeGroupId ? { _id: { $ne: excludeGroupId } } : {}),
  });

  for (const candidate of candidates) {
    if (!candidate.days?.length || !candidate.startTime || !candidate.endTime) continue;

    const commonDay = days.find((d) => candidate.days.includes(d));
    if (!commonDay) continue;

    if (!timesOverlap(startTime, endTime, candidate.startTime, candidate.endTime)) continue;

    const subject = await Subject.findOne({ _id: candidate.subject });
    const err = new Error("room.busyAtThisTime");
    err.conflict = {
      room: room.name,
      day: commonDay,
      startTime: candidate.startTime,
      endTime: candidate.endTime,
      label: subject?.name || "",
    };
    throw err;
  }
};

// Guruh o'zgardi — O'QITUVCHI/YORDAMCHI panellari realtime yangilanishi
// uchun (guruh biriktirildi, jadval o'zgardi, yakunlandi...). Payload'da
// biriktirilgan hodimlar bor, frontend o'ziga tegishlisini filtrlaydi.
const emitGroupChanged = (clientId, group, action = "updated") => {
  emit(`client:${clientId}`, "group:changed", {
    groupId: String(group._id),
    action,
    status: group.status,
    teacher: group.teacher ? String(group.teacher) : null,
    assistant: group.assistant ? String(group.assistant) : null,
    center: String(group.center),
  });
};

// ─── Ommaviy qayta tartiblash ("Tartiblash") yordamchilari ────────────────
// API_CONTRACT_group_reschedule.md

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Bitta joylashuvni tekshiradi. `existing` — solishtiriladigan boshqa
// joylashuvlar ro'yxati (qoralamada faqat qoralamaning o'zi, commit'da esa
// yakuniy holat). Konflikt topilsa `conflict` maydonli Error otiladi.
const validatePlacement = ({ groupId, roomId, days, startTime, endTime }, existing, labelOf, roomNameOf) => {
  if (!groupId || !roomId) throw new Error("group.fillTheRows");
  if (!Array.isArray(days) || !days.length) throw new Error("group.fillTheRows");
  validateDays(days);
  if (!TIME_RE.test(startTime || "") || !TIME_RE.test(endTime || "")) {
    throw new Error("group.invalidTime");
  }
  if (toMinutes(startTime) >= toMinutes(endTime)) throw new Error("group.invalidTime");

  for (const other of existing) {
    if (String(other.groupId) === String(groupId)) continue;
    if (String(other.roomId) !== String(roomId)) continue;

    const commonDay = days.find((d) => other.days.includes(d));
    if (!commonDay) continue;
    if (!timesOverlap(startTime, endTime, other.startTime, other.endTime)) continue;

    // Shakl checkRoomConflict() bilan AYNI — frontend (GroupScheduleDialog)
    // allaqachon shu maydonlarni kutadi.
    const err = new Error("room.busyAtThisTime");
    err.conflict = {
      room: roomNameOf ? roomNameOf(other.roomId) : "",
      day: commonDay,
      startTime: other.startTime,
      endTime: other.endTime,
      label: labelOf ? labelOf(other.groupId) : "",
    };
    throw err;
  }
};

// Qoralamadagi `placements` obyektini validatsiya ro'yxatiga aylantiradi.
const toList = (placements) =>
  Object.entries(placements || {}).map(([groupId, p]) => ({ groupId, ...p }));

// Jadval ish maydonining ma'lumot bazasi: shu tenantning (staff'da — shu
// filialning) barcha pending+active guruhlari va faol xonalari. `rescheduleStart`
// bundan Redis qoralamasini yasaydi, `rescheduleCommit` esa frontend yuborgan
// joylashuvlarni tekshirish uchun ishlatadi.
const buildScheduleData = async (clientId, staffCenter = "") => {
  const filter = scopeFilter(clientId, staffCenter);

  // Jadval ish maydonida xonalar FILIAL bo'yicha guruhlab ko'rsatiladi,
  // shuning uchun filial nomlari ham qaytariladi (aks holda frontend
  // faqat ObjectId ko'rardi).
  const [groups, rooms, centers] = await Promise.all([
    Group.find({ ...filter, status: { $in: ["pending", "active"] } }).sort({ createdAt: -1 }),
    Room.find({ ...filter, status: { $ne: "inactive" } }).select("name center capacity"),
    // Center'da filial identifikatori `_id` (boshqa modellardagi kabi
    // `center` maydoni emas) — shu sabab scopeFilter ishlatilmaydi.
    Center.find({
      client: clientId,
      isDeleted: false,
      status: { $ne: "blocked" },
      ...(staffCenter ? { _id: staffCenter } : {}),
    })
      .select("name")
      .sort({ createdAt: 1 }),
  ]);

  const subjectIds = [...new Set(groups.map((g) => String(g.subject)))];
  const teacherIds = [...new Set(groups.filter((g) => g.teacher).map((g) => String(g.teacher)))];
  const [subjects, teachers] = await Promise.all([
    Subject.find({ _id: { $in: subjectIds } }, { name: 1 }),
    Staff.find({ _id: { $in: teacherIds } }, { name: 1 }),
  ]);
  const subjectMap = Object.fromEntries(subjects.map((x) => [String(x._id), x.name]));
  const teacherMap = Object.fromEntries(teachers.map((x) => [String(x._id), x.name]));
  const countMap = await getStudentsCountMap(groups.map((g) => g._id));

  return {
    startedAt: getNow(),
    groups: groups.map((g) => ({
      _id: String(g._id),
      label: `${subjectMap[String(g.subject)] || "?"} - ${g.status === "pending" ? g.pendingId : g.activeId}`,
      teacher: teacherMap[String(g.teacher)] || "",
      studentsCount: countMap[String(g._id)] || 0,
      maxStudents: g.maxStudents ?? null,
      status: g.status,
      center: String(g.center),
      // Guruhning HOZIRGI jadvali — sahifa ochilganda ish maydoni aynan shundan
      // to'ldiriladi ("Qayta tartiblash" bosilmaguncha hammasi joyida turadi).
      original: {
        room: g.room ? String(g.room) : null,
        days: g.days || [],
        startTime: g.startTime || "",
        endTime: g.endTime || "",
      },
    })),
    rooms: rooms.map((r) => ({
      _id: String(r._id),
      name: r.name,
      center: String(r.center),
      capacity: r.capacity ?? null,
    })),
    // Filiallar — xonalar/guruhlarni bo'limlarga ajratish uchun (tartibi
    // yaratilgan vaqti bo'yicha, ya'ni ro'yxat har safar bir xil chiqadi).
    centers: centers.map((c) => ({ _id: String(c._id), name: c.name })),
    placements: {},
  };
};

// Staff faqat o'z filiali doirasida ishlaydi — qoralamaga ham, commit'ga ham
// shu filial guruhlari/xonalari kiradi.
const scopeFilter = (clientId, staffCenter) => {
  const f = { client: clientId, isDeleted: false };
  if (staffCenter) f.center = staffCenter;
  return f;
};

module.exports = {
  DTO,

  create: async (clientId, body) => {
    const { centerId, subjectId, teacherId, assistantId, roomId, days, startTime, endTime, maxStudents } =
      body;
    if (!centerId || !subjectId) throw new Error("group.fillTheRows");
    if (maxStudents != null && maxStudents < 0) throw new Error("group.invalidMaxStudents");
    validateDays(days);

    const { center, subject } = await validateCenterSubject(clientId, centerId, subjectId);
    const teacher = await validateTeacher(clientId, center._id, teacherId);
    const assistant = await validateAssistant(clientId, center._id, assistantId);
    const room = await validateRoom(clientId, center._id, roomId);

    await checkRoomConflict(clientId, center._id, room, days, startTime, endTime);

    const pendingId = await Counter.next(`group_pending_${clientId}`);

    const group = await Group.create({
      client: clientId,
      center: center._id,
      subject: subject._id,
      teacher: teacher?._id || null,
      assistant: assistant?._id || null,
      room: room?._id || null,
      days: days || [],
      startTime: startTime || "",
      endTime: endTime || "",
      maxStudents: maxStudents ?? null,
      status: "pending",
      pendingId,
    });

    emitGroupChanged(clientId, group, "created");
    return DTO(group, 0);
  },

  list: async (
    clientId,
    { page = 1, search = "", center = "", teacher = "", assistant = "", status = "", days = "" },
  ) => {
    const trimmedSearch = search?.trim();
    const baseFilter = { client: clientId, isDeleted: false };
    if (center) baseFilter.center = center;
    if (teacher) baseFilter.teacher = teacher;
    if (assistant) baseFilter.assistant = assistant;
    if (status && ["pending", "active", "finished"].includes(status)) baseFilter.status = status;
    // OR semantikasi: tanlangan kunlardan kamida bittasi bo'lsa yetarli.
    const dayList = parseDays(days);
    if (dayList.length) baseFilter.days = { $in: dayList };

    if (trimmedSearch) {
      const regex = new RegExp(trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const all = await Group.find(baseFilter).sort({ createdAt: -1 });

      const subjectIds = [...new Set(all.map((g) => String(g.subject)))];
      const teacherIds = [...new Set(all.filter((g) => g.teacher).map((g) => String(g.teacher)))];
      const [subjects, teachers] = await Promise.all([
        Subject.find({ _id: { $in: subjectIds } }),
        Staff.find({ _id: { $in: teacherIds } }),
      ]);
      const subjectMap = Object.fromEntries(subjects.map((s) => [String(s._id), s.name]));
      const teacherMap = Object.fromEntries(teachers.map((s) => [String(s._id), s.name]));

      const data = all.filter(
        (g) =>
          regex.test(subjectMap[String(g.subject)] || "") ||
          (g.teacher && regex.test(teacherMap[String(g.teacher)] || "")),
      );

      const [countMap, syllabusMap, roomNameMap, subjectNameMap] = await Promise.all([
        getStudentsCountMap(data.map((g) => g._id)),
        getSyllabusMap(clientId, data),
        getRoomNameMap(data),
        getSubjectNameMap(data),
      ]);
      return {
        data: data.map((g) =>
          DTO(
            g,
            countMap[String(g._id)] || 0,
            syllabusMap[String(g._id)] || null,
            roomNameMap[String(g.room)] || null,
            subjectNameMap[String(g.subject)] || null,
          ),
        ),
        meta: { page: 1, limit: data.length, total: data.length, totalPages: 1 },
      };
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const skip = (pageNum - 1) * PAGE_SIZE;

    const [data, total] = await Promise.all([
      Group.find(baseFilter).sort({ createdAt: -1 }).skip(skip).limit(PAGE_SIZE),
      Group.countDocuments(baseFilter),
    ]);

    const [countMap, syllabusMap, roomNameMap, subjectNameMap] = await Promise.all([
      getStudentsCountMap(data.map((g) => g._id)),
      getSyllabusMap(clientId, data),
      getRoomNameMap(data),
      getSubjectNameMap(data),
    ]);

    return {
      data: data.map((g) =>
        DTO(
          g,
          countMap[String(g._id)] || 0,
          syllabusMap[String(g._id)] || null,
          roomNameMap[String(g.room)] || null,
          subjectNameMap[String(g.subject)] || null,
        ),
      ),
      meta: {
        page: pageNum,
        limit: PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / PAGE_SIZE) || 1,
      },
    };
  },

  getOne: async (clientId, id) => {
    const group = await Group.findOne({ _id: id, client: clientId, isDeleted: false });
    if (!group) throw new Error("group.notFound");

    const [countMap, syllabusMap, roomNameMap, subjectNameMap] = await Promise.all([
      getStudentsCountMap([group._id]),
      getSyllabusMap(clientId, [group]),
      getRoomNameMap([group]),
      getSubjectNameMap([group]),
    ]);
    return DTO(
      group,
      countMap[String(group._id)] || 0,
      syllabusMap[String(group._id)] || null,
      roomNameMap[String(group.room)] || null,
      subjectNameMap[String(group.subject)] || null,
    );
  },

  // Excel export — list() bilan bir xil filtr, sahifalashsiz, Filial/Fan/
  // O'qituvchi nomi hal qilingan holda.
  exportList: async (clientId, { search = "", center = "", teacher = "", status = "", days = "" }) => {
    const trimmedSearch = search?.trim();
    const baseFilter = { client: clientId, isDeleted: false };
    if (center) baseFilter.center = center;
    if (teacher) baseFilter.teacher = teacher;
    if (status && ["pending", "active", "finished"].includes(status)) baseFilter.status = status;
    // Eksport ekrandagi ro'yxatga mos tushishi uchun list() bilan bir xil filtr.
    const dayList = parseDays(days);
    if (dayList.length) baseFilter.days = { $in: dayList };

    const all = await Group.find(baseFilter).sort({ createdAt: -1 });

    const centerIds = [...new Set(all.map((g) => String(g.center)))];
    const subjectIds = [...new Set(all.map((g) => String(g.subject)))];
    const teacherIds = [...new Set(all.filter((g) => g.teacher).map((g) => String(g.teacher)))];
    const [centers, subjects, teachers] = await Promise.all([
      Center.find({ _id: { $in: centerIds } }, { name: 1 }),
      Subject.find({ _id: { $in: subjectIds } }, { name: 1 }),
      Staff.find({ _id: { $in: teacherIds } }, { name: 1 }),
    ]);
    const centerMap = Object.fromEntries(centers.map((c) => [String(c._id), c.name]));
    const subjectMap = Object.fromEntries(subjects.map((s) => [String(s._id), s.name]));
    const teacherMap = Object.fromEntries(teachers.map((s) => [String(s._id), s.name]));

    let filtered = all;
    if (trimmedSearch) {
      const regex = new RegExp(trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filtered = all.filter(
        (g) =>
          regex.test(subjectMap[String(g.subject)] || "") ||
          (g.teacher && regex.test(teacherMap[String(g.teacher)] || "")),
      );
    }

    const countMap = await getStudentsCountMap(filtered.map((g) => g._id));

    return filtered.map((g) => ({
      label: `${subjectMap[String(g.subject)] || "?"} - ${g.status === "pending" ? g.pendingId : g.activeId}`,
      centerName: centerMap[String(g.center)] || "—",
      teacherName: g.teacher ? teacherMap[String(g.teacher)] || "—" : "",
      days: g.days || [],
      startTime: g.startTime || "",
      endTime: g.endTime || "",
      status: g.status,
      studentsCount: countMap[String(g._id)] || 0,
    }));
  },

  // Excel export — bitta guruh: shu guruhdagi o'quvchilar (jonli to'lov/
  // qarzdorlik bilan — student.service.js "DTO" orqali, computeBilling bilan
  // bir xil hisob-kitob, jadval/detail sahifadagi raqamlar bilan mos keladi).
  exportOne: async (clientId, id) => {
    const group = await Group.findOne({ _id: id, client: clientId, isDeleted: false });
    if (!group) throw new Error("group.notFound");

    const students = await Student.find(
      { "groups.group": group._id, "groups.client": clientId, isDeleted: false },
      { fullName: 1, phone: 1, groups: 1 },
    );

    // eslint-disable-next-line global-require
    const studentService = require("./student.service");
    const rows = [];
    for (const student of students) {
      const dto = await studentService.DTO(student, clientId);
      const entry = dto.groups.find((g) => String(g.group) === String(group._id));
      if (!entry) continue;
      rows.push({
        fullName: dto.fullName,
        phone: dto.phone,
        price: entry.price || 0,
        status: entry.status,
        paid: entry.paidForCurrentCycle || 0,
        due: entry.currentCyclePrice || 0,
        debt: Math.max(0, (entry.currentCyclePrice || 0) - (entry.paidForCurrentCycle || 0)),
      });
    }

    return { group: DTO(group, rows.length), rows };
  },

  activate: async (clientId, id, body = {}) => {
    const group = await Group.findOne({ _id: id, client: clientId, isDeleted: false });
    if (!group) throw new Error("group.notFound");
    if (group.status !== "pending") throw new Error("group.alreadyActivated");

    const { teacherId, assistantId, roomId, days, startTime, endTime, startDate } = body;

    if (maxStudentsInvalid(body)) throw new Error("group.invalidMaxStudents");
    validateDays(days);
    if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      throw new Error("group.invalidStartDate");
    }

    if (teacherId) group.teacher = (await validateTeacher(clientId, group.center, teacherId))._id;
    // Yordamchi ixtiyoriy: bo'sh satr yuborilsa biriktirish OLIB TASHLANADI.
    if (assistantId !== undefined) {
      group.assistant = assistantId
        ? (await validateAssistant(clientId, group.center, assistantId))._id
        : null;
    }
    if (roomId) group.room = (await validateRoom(clientId, group.center, roomId))._id;
    if (days) group.days = days;
    if (startTime !== undefined) group.startTime = startTime;
    if (endTime !== undefined) group.endTime = endTime;
    if (body.maxStudents !== undefined) group.maxStudents = body.maxStudents;

    if (!group.teacher || !group.room || !group.days?.length || !group.startTime || !group.endTime) {
      throw new Error("group.activationIncomplete");
    }

    const room = await Room.findOne({ _id: group.room, isDeleted: false });
    await checkRoomConflict(
      clientId,
      group.center,
      room,
      group.days,
      group.startTime,
      group.endTime,
      group._id,
    );

    group.activeId = await Counter.next(`group_active_${clientId}`);
    group.status = "active";
    // Darslar aynan qachon boshlanishi kalendar orqali tanlanadi — kelasi
    // sanaga ham qo'yish mumkin (masalan bugun activlashtirib, darslar
    // dushanbadan boshlansin desa), student.service.js "computeBilling" bu
    // sanani o'tib bo'lmagunicha qarzdorlik hisoblamaydi.
    group.activatedAt = startDate ? dateStringToUnix(startDate) : getNow();
    await group.save();
    emitGroupChanged(clientId, group, "activated");

    const countMap = await getStudentsCountMap([group._id]);
    return DTO(group, countMap[String(group._id)] || 0);
  },

  // Allaqachon FAOL guruhning kun/xona/o'qituvchi/soatini qayta belgilash —
  // activate()dan farqli, status/activeId/activatedAt'ga tegmaydi, faqat
  // jadval maydonlarini yangilaydi. Xona to'qnashuvi xuddi activate'dagi
  // kabi tekshiriladi (o'zining joriy bandligi excludeGroupId orqali
  // hisobga olinmaydi).
  reschedule: async (clientId, id, body = {}) => {
    const group = await Group.findOne({ _id: id, client: clientId, isDeleted: false });
    if (!group) throw new Error("group.notFound");
    if (group.status !== "active") throw new Error("group.notActive");

    const { teacherId, assistantId, roomId, days, startTime, endTime } = body;
    validateDays(days);

    const teacher = teacherId ? await validateTeacher(clientId, group.center, teacherId) : null;
    const room = roomId ? await validateRoom(clientId, group.center, roomId) : null;
    if (assistantId !== undefined) {
      group.assistant = assistantId
        ? (await validateAssistant(clientId, group.center, assistantId))._id
        : null;
    }

    const nextDays = days || group.days;
    const nextStartTime = startTime !== undefined ? startTime : group.startTime;
    const nextEndTime = endTime !== undefined ? endTime : group.endTime;
    const nextRoom = room || (await Room.findOne({ _id: group.room, isDeleted: false }));

    await checkRoomConflict(
      clientId,
      group.center,
      nextRoom,
      nextDays,
      nextStartTime,
      nextEndTime,
      group._id,
    );

    if (teacher) group.teacher = teacher._id;
    if (room) group.room = room._id;
    if (days) group.days = days;
    if (startTime !== undefined) group.startTime = startTime;
    if (endTime !== undefined) group.endTime = endTime;
    await group.save();
    emitGroupChanged(clientId, group, "updated");

    const countMap = await getStudentsCountMap([group._id]);
    return DTO(group, countMap[String(group._id)] || 0);
  },

  // ─── Ommaviy qayta tartiblash ─────────────────────────────────────────
  // Qoralama Redis'da (rescheduleDraft.util), DB'ga commit'gacha TEGILMAYDI.
  // Shu sabab "Chiqish" hech narsani orqaga qaytarishi shart emas.

  scheduleData: async (clientId, staffCenter = "") => buildScheduleData(clientId, staffCenter),

  rescheduleStart: async (clientId, userId, staffCenter = "") =>
    rescheduleDraft.save(clientId, userId, await buildScheduleData(clientId, staffCenter)),

  rescheduleGet: async (clientId, userId) => rescheduleDraft.get(clientId, userId),

  reschedulePlace: async (clientId, userId, body = {}) => {
    const draft = await rescheduleDraft.get(clientId, userId);
    if (!draft) throw new Error("group.noDraft");

    const { groupId, roomId, days, startTime, endTime } = body;

    const group = draft.groups.find((g) => g._id === String(groupId));
    if (!group) throw new Error("group.notFound");
    const room = draft.rooms.find((r) => r._id === String(roomId));
    if (!room) throw new Error("room.notFound");
    // Guruh boshqa filialning xonasiga tushib qolmasligi kerak.
    if (group.center !== room.center) throw new Error("room.notFound");

    const labelOf = (id) => draft.groups.find((g) => g._id === String(id))?.label || "";
    const roomNameOf = (id) => draft.rooms.find((r) => r._id === String(id))?.name || "";

    validatePlacement(
      { groupId: String(groupId), roomId: String(roomId), days, startTime, endTime },
      toList(draft.placements),
      labelOf,
      roomNameOf,
    );

    draft.placements[String(groupId)] = {
      roomId: String(roomId),
      days,
      startTime,
      endTime,
    };

    return rescheduleDraft.save(clientId, userId, draft);
  },

  rescheduleUnplace: async (clientId, userId, groupId) => {
    const draft = await rescheduleDraft.get(clientId, userId);
    if (!draft) throw new Error("group.noDraft");

    delete draft.placements[String(groupId)];
    return rescheduleDraft.save(clientId, userId, draft);
  },

  rescheduleDiscard: async (clientId, userId) => {
    await rescheduleDraft.remove(clientId, userId);
    return true;
  },

  /**
   * Qoralamani real Group hujjatlariga qo'llaydi.
   *
   * mode="placed" (default): faqat joylashtirilganlar yangilanadi,
   *   qolganlarning eski jadvali SAQLANADI.
   * mode="full":  joylashtirilmaganlarning jadvali TOZALANADI.
   *
   * Ikkala rejimda ham yozishdan oldin YAKUNIY holat tekshiriladi — bitta
   * konflikt bo'lsa hech narsa yozilmaydi (qisman qo'llash jadvalni buzardi).
   */
  // `placements` bodyda kelsa Redis qoralamasi KERAK EMAS — jadval sahifasi
  // joylashuvlarni o'zida (frontendda) saqlaydi. Kelmasa eski oqim ishlaydi.
  rescheduleCommit: async (
    clientId,
    userId,
    { mode = "placed", placements } = {},
    staffCenter = "",
  ) => {
    const draft = placements
      ? { ...(await buildScheduleData(clientId, staffCenter)), placements }
      : await rescheduleDraft.get(clientId, userId);
    if (!draft) throw new Error("group.noDraft");

    const placed = toList(draft.placements);
    if (!placed.length) throw new Error("group.noPlacements");

    // Frontenddan kelgan joylashuvlar: guruh ham, xona ham shu tenantga
    // (staff'da — shu filialga) tegishli bo'lishi shart.
    if (placements) {
      for (const p of placed) {
        const group = draft.groups.find((g) => g._id === String(p.groupId));
        if (!group) throw new Error("group.notFound");
        const room = draft.rooms.find((r) => r._id === String(p.roomId));
        if (!room || room.center !== group.center) throw new Error("room.notFound");
      }
    }

    const isFull = mode === "full";
    const placedIds = new Set(placed.map((p) => p.groupId));

    // Yakuniy holat: joylashtirilganlar (yangi slot) + "placed" rejimda
    // joylashtirilmaganlar (eski slot). Aks holda commit'dan keyin ikki guruh
    // bitta xonada bir vaqtda qolib ketardi.
    const finalState = [...placed];
    if (!isFull) {
      for (const g of draft.groups) {
        if (placedIds.has(g._id)) continue;
        const o = g.original;
        if (!o.room || !o.days?.length || !o.startTime || !o.endTime) continue;
        finalState.push({
          groupId: g._id,
          roomId: o.room,
          days: o.days,
          startTime: o.startTime,
          endTime: o.endTime,
        });
      }
    }

    const labelOf = (id) => draft.groups.find((g) => g._id === String(id))?.label || "";
    const roomNameOf = (id) => draft.rooms.find((r) => r._id === String(id))?.name || "";
    for (const p of finalState) {
      validatePlacement(p, finalState, labelOf, roomNameOf);
    }

    // Tekshiruv o'tdi — endi yozamiz.
    const filter = scopeFilter(clientId, staffCenter);
    const ops = placed.map((p) => ({
      updateOne: {
        filter: { ...filter, _id: p.groupId },
        update: {
          $set: {
            room: p.roomId,
            days: p.days,
            startTime: p.startTime,
            endTime: p.endTime,
            lastUpdate: getNow(),
          },
        },
      },
    }));

    if (isFull) {
      const unplacedIds = draft.groups.filter((g) => !placedIds.has(g._id)).map((g) => g._id);
      if (unplacedIds.length) {
        ops.push({
          updateMany: {
            filter: { ...filter, _id: { $in: unplacedIds } },
            update: { $set: { days: [], startTime: "", endTime: "", lastUpdate: getNow() } },
          },
        });
      }
    }

    const res = await Group.bulkWrite(ops);
    await rescheduleDraft.remove(clientId, userId);

    return {
      updated: placed.length,
      cleared: isFull ? draft.groups.length - placed.length : 0,
      modified: res.modifiedCount || 0,
    };
  },

  finish: async (clientId, id) => {
    const group = await Group.findOne({ _id: id, client: clientId, isDeleted: false });
    if (!group) throw new Error("group.notFound");
    if (group.status !== "active") throw new Error("group.notActive");

    group.status = "finished";
    group.finishedAt = getNow();
    await group.save();
    emitGroupChanged(clientId, group, "finished");

    const countMap = await getStudentsCountMap([group._id]);
    return DTO(group, countMap[String(group._id)] || 0);
  },
};

function maxStudentsInvalid(body) {
  return body.maxStudents !== undefined && body.maxStudents != null && body.maxStudents < 0;
}
