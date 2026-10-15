const { Types } = require("mongoose");
const Group = require("../models/Group");
const Syllabus = require("../models/Syllabus");
const Center = require("../models/Center");
const Subject = require("../models/Subject");
const Staff = require("../models/Staff");
const Room = require("../models/Room");
const Student = require("../models/Student");
const Counter = require("../models/Counter");
const { getNow, dateStringToUnix, todayString, formatDay } = require("../utils/date.util");
const { photoFor } = require("../utils/studentPhoto.util");
const syllabusProgress = require("../utils/syllabusProgress.util");
const emit = require("../utils/emitter.util");
const audit = require("../utils/audit.util");
const { archiveGroupEntries, emitArchiveChanged } = require("../utils/archive.util");

const PAGE_SIZE = 50;

// Individual guruh (API_CONTRACT_individual_students.md) — eski hujjatlarda
// `kind` yo'q, shu sabab "oddiy guruh" sharti doim `$ne` orqali.
const NOT_INDIVIDUAL = { $ne: "individual" };

// GET /groups `kind` query'si → Mongo sharti. Yo'q/"group" — faqat oddiy
// guruhlar (default), "individual" — faqat individual, "all" — ikkalasi.
const kindFilterOf = (kind) => {
  if (kind === "individual") return "individual";
  if (kind === "all") return null;
  return NOT_INDIVIDUAL;
};

// O'qituvchi foizi 0..100 (butun bo'lishi shart emas) — aks holda xato.
const parsePercent = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0 || num > 100) return undefined;
  return num;
};

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

// Telegram guruh havolasini normallashtirish. Qabul qilinadi:
// `https://t.me/x`, `http://t.me/x`, `t.me/x`, `telegram.me/x`,
// `https://t.me/+Hash`, `https://t.me/joinchat/Hash`, `@username`.
// Natija: `https://t.me/<path>`; bo'sh → null; yaroqsiz → undefined.
const TG_PATH_RE = /^(?:\+[A-Za-z0-9_-]{5,}|joinchat\/[A-Za-z0-9_-]{5,}|[A-Za-z][A-Za-z0-9_]{3,31})$/;
const normalizeTelegramLink = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return undefined;
  const raw = value.trim();
  if (!raw) return null;

  if (raw.startsWith("@")) {
    const username = raw.slice(1);
    return TG_PATH_RE.test(username) && !username.includes("/") && !username.startsWith("+")
      ? `https://t.me/${username}`
      : undefined;
  }

  const match = raw.match(/^(?:https?:\/\/)?(?:www\.)?(?:t|telegram)\.me\/(.+)$/i);
  if (!match) return undefined;
  const path = match[1].replace(/[?#].*$/, "").replace(/\/+$/, "");
  return TG_PATH_RE.test(path) ? `https://t.me/${path}` : undefined;
};

// `individualStudent` — faqat individual guruhda (ro'yxat/getOne). `hideFinance` —
// o'qituvchi/yordamchi so'raganda `teacherPercent` (moliyaviy) yashiriladi.
const DTO = (
  data,
  studentsCount = 0,
  syllabus = null,
  roomName = null,
  subjectName = null,
  { individualStudent = null, hideFinance = false } = {},
) => ({
  _id: data?._id,
  kind: data?.kind === "individual" ? "individual" : "group",
  teacherPercent: hideFinance ? null : data?.teacherPercent ?? null,
  coinsEnabled: data?.kind === "individual" ? !!data?.coinsEnabled : true,
  individualStudent: data?.kind === "individual" ? individualStudent : null,
  client: data?.client,
  center: data?.center,
  subject: data?.subject,
  subjectName,
  name: data?.name || null,
  telegramLink: data?.telegramLink || null,
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

    // Manfiy offset (reja kechroq biriktirilgan) — 0 bilan qisiladi.
    const doneCount = syllabusProgress.clampDone((doneMap[key] || 0) + (offsetMap[key] || 0));
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

// Individual guruhlarning o'quvchisi — BITTA so'rovda: faol a'zo bo'lsa o'sha,
// aks holda (chiqqan) oxirgi a'zo. Arxivlangan a'zolik hisobga olinmaydi.
const getIndividualStudentMap = async (clientId, groups) => {
  const ids = groups.filter((g) => g.kind === "individual").map((g) => g._id);
  if (!ids.length) return {};
  const students = await Student.find(
    { isDeleted: false, groups: { $elemMatch: { group: { $in: ids }, status: { $ne: "archived" } } } },
    { fullName: 1, phone: 1, photos: 1, groups: 1 },
  );
  const idSet = new Set(ids.map(String));
  const map = {};
  for (const st of students) {
    for (const entry of st.groups) {
      const key = String(entry.group);
      if (!idSet.has(key) || entry.status === "archived") continue;
      const cur = map[key];
      if (cur && (cur.active || entry.status !== "active")) continue;
      map[key] = {
        active: entry.status === "active",
        value: { _id: st._id, fullName: st.fullName, phone: st.phone, photo: photoFor(st, clientId) },
      };
    }
  }
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v.value]));
};

// Ro'yxat/getOne uchun umumiy: barcha yordamchi xaritalar + DTO.
const buildDTOs = async (clientId, groups, hideFinance = false) => {
  const [countMap, syllabusMap, roomNameMap, subjectNameMap, individualMap] = await Promise.all([
    getStudentsCountMap(groups.map((g) => g._id)),
    getSyllabusMap(clientId, groups),
    getRoomNameMap(groups),
    getSubjectNameMap(groups),
    getIndividualStudentMap(clientId, groups),
  ]);
  return groups.map((g) =>
    DTO(
      g,
      countMap[String(g._id)] || 0,
      syllabusMap[String(g._id)] || null,
      roomNameMap[String(g.room)] || null,
      subjectNameMap[String(g.subject)] || null,
      { individualStudent: individualMap[String(g._id)] || null, hideFinance },
    ),
  );
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
    centers: centerId,
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
    centers: centerId,
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
    // Individual guruhlar to'qnashuv nomzodi emas (kontrakt §0.4).
    kind: NOT_INDIVIDUAL,
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
// `extra` — o'zgargan maydonning o'zi (masalan "telegram" → `telegramLink`),
// shunda tinglovchilar butun guruhni qayta yuklamasdan joyida yangilaydi.
const emitGroupChanged = (clientId, group, action = "updated", extra = {}) => {
  emit(`client:${clientId}`, "group:changed", {
    groupId: String(group._id),
    action,
    status: group.status,
    teacher: group.teacher ? String(group.teacher) : null,
    assistant: group.assistant ? String(group.assistant) : null,
    center: String(group.center),
    ...extra,
  });
};

// ─── Jadval ish maydoni yordamchilari ─────────────────────────────────────
// API_CONTRACT_group_schedule_per_group.md

// Jadval ish maydonining ma'lumot bazasi: shu tenantning (staff'da — shu
// filialning) barcha pending+active guruhlari va faol xonalari.
const buildScheduleData = async (clientId, staffCenter = "") => {
  const filter = scopeFilter(clientId, staffCenter);

  // Jadval ish maydonida xonalar FILIAL bo'yicha guruhlab ko'rsatiladi,
  // shuning uchun filial nomlari ham qaytariladi (aks holda frontend
  // faqat ObjectId ko'rardi).
  const [groups, rooms, centers] = await Promise.all([
    // Individual guruhlar jadval ish maydonida ko'rinmaydi.
    Group.find({ ...filter, status: { $in: ["pending", "active"] }, kind: NOT_INDIVIDUAL }).sort({ createdAt: -1 }),
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

  // Arxiv moduli (archive.service.js `restoreGroup`) guruhni qaytarishdan
  // oldin xuddi shu xona to'qnashuvini tekshirish uchun qayta ishlatadi —
  // arxivlangan payt bo'shab qolgan slot boshqa guruhga berilgan bo'lishi
  // mumkin.
  checkRoomConflict,
  validateRoom,
  emitGroupChanged,

  create: async (clientId, body, staff = null) => {
    const { centerId, subjectId, assistantId, roomId, days, startTime, endTime, maxStudents } = body;
    // O'qituvchi o'zi guruh yaratsa, u DOIM shu guruhning o'qituvchisi
    // bo'ladi — boshqa o'qituvchini `teacherId` orqali yubormoqchi bo'lsa ham
    // e'tiborga olinmaydi (frontend ham maydonni qulflab qo'ygan, bu yerda
    // esa yakuniy kafolat).
    const teacherId = staff?.role === "teacher" ? String(staff._id) : body.teacherId;
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

  // Individual o'quvchi qo'shish (API_CONTRACT_individual_students.md §2):
  // yashirin 1 kishilik guruh yaratiladi va o'quvchi MAVJUD
  // `studentService.create` orqali unga qo'shiladi (yangi parallel mantiq
  // yo'q). Jadval ixtiyoriy, to'qnashuv tekshirilmaydi. Guruh darhol
  // `active` — activate bosqichi yo'q.
  createIndividual: async (clientId, body = {}, actor = null) => {
    const { centerId, subjectId, teacherId, roomId, days, startTime, endTime, startDate } = body;
    if (!centerId || !subjectId || !teacherId) throw new Error("group.fillTheRows");
    const teacherPercent = parsePercent(body.teacherPercent);
    if (teacherPercent === undefined || teacherPercent === null) throw new Error("individual.invalidPercent");
    validateDays(days);
    if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new Error("group.invalidStartDate");
    const startDay = startDate || todayString();
    const activatedAt = dateStringToUnix(startDay);
    if (!Number.isFinite(activatedAt) || formatDay(activatedAt) !== startDay) {
      throw new Error("group.invalidStartDate");
    }

    const { center, subject } = await validateCenterSubject(clientId, centerId, subjectId);
    const teacher = await validateTeacher(clientId, center._id, teacherId);
    const room = await validateRoom(clientId, center._id, roomId);

    // Alohida ketma-ketlik — oddiy guruh raqamlari buzilmasin.
    const number = await Counter.next(`group_individual_${clientId}`);

    const group = await Group.create({
      kind: "individual",
      // Nom — chek, Tushumlar, Telegram xabarlari va eksportlarda "Fan - 1"
      // (oddiy guruh raqami bilan adashadigan) yorliq o'rniga ko'rinadi.
      name: `${subject.name} · Individual`,
      client: clientId,
      center: center._id,
      subject: subject._id,
      teacher: teacher._id,
      teacherPercent,
      coinsEnabled: body.coinsEnabled === true,
      assistant: null,
      room: room?._id || null,
      days: days || [],
      startTime: startTime || "",
      endTime: endTime || "",
      maxStudents: 1,
      status: "active",
      pendingId: number,
      activeId: number,
      activatedAt,
    });

    let student;
    try {
      // eslint-disable-next-line global-require
      const studentService = require("./student.service");
      // `startDate` a'zolikka ham (joinedAt) — guruh boshlangan kundan o'qiydi,
      // o'tgan kunlar uchun "kech qo'shildi" kreditlari yozilmaydi.
      student = await studentService.create(
        clientId,
        { ...body, centerId: String(center._id), groupId: String(group._id), startDate: startDay },
        actor,
      );
    } catch (error) {
      // Guruh hali hech qanday yozuvga ega emas — izsiz o'chiriladi.
      await Group.deleteOne({ _id: group._id });
      throw error;
    }

    emitGroupChanged(clientId, group, "created");
    void audit.log({
      actor,
      client: clientId,
      center: center._id,
      action: "group:create",
      entity: { type: "group", id: group._id, label: student.fullName || subject.name },
      meta: { kind: "individual", teacherPercent, studentId: String(student._id) },
    });

    const [dto] = await buildDTOs(clientId, [group]);
    return { group: dto, student };
  },

  // Individual guruh foizi/o'qituvchisini tahrirlash (§2 PATCH /:id/individual).
  updateIndividual: async (clientId, id, body = {}, actor = null) => {
    const group = await Group.findOne({ _id: id, client: clientId, isDeleted: false });
    if (!group) throw new Error("group.notFound");
    if (group.kind !== "individual") throw new Error("group.notIndividual");

    const changes = [];
    if (body.teacherPercent !== undefined) {
      const percent = parsePercent(body.teacherPercent);
      if (percent === undefined || percent === null) throw new Error("individual.invalidPercent");
      if (percent !== group.teacherPercent) {
        changes.push({ field: "teacherPercent", from: group.teacherPercent, to: percent });
        group.teacherPercent = percent;
      }
    }
    if (typeof body.coinsEnabled === "boolean" && body.coinsEnabled !== !!group.coinsEnabled) {
      changes.push({ field: "coinsEnabled", from: !!group.coinsEnabled, to: body.coinsEnabled });
      group.coinsEnabled = body.coinsEnabled;
    }
    if (body.teacherId !== undefined && body.teacherId !== null && body.teacherId !== "") {
      const teacher = await validateTeacher(clientId, group.center, body.teacherId);
      if (String(teacher._id) !== String(group.teacher)) {
        changes.push({ field: "teacher", from: group.teacher ? String(group.teacher) : null, to: String(teacher._id) });
        group.teacher = teacher._id;
      }
    }

    if (changes.length) {
      await group.save();
      emitGroupChanged(clientId, group, "updated");
      // Foiz/o'qituvchi o'zgardi — oylik jonli qayta hisoblansin.
      emit(`client:${clientId}`, "salary:updated", { staff: group.teacher ? String(group.teacher) : null });
      const subject = await Subject.findById(group.subject).select("name");
      void audit.log({
        actor,
        client: clientId,
        center: group.center,
        action: "group:update",
        entity: { type: "group", id: group._id, label: group.name || subject?.name || "" },
        changes,
        meta: { kind: "individual" },
      });
    }

    const [dto] = await buildDTOs(clientId, [group]);
    return dto;
  },

  list: async (
    clientId,
    { page = 1, search = "", center = "", teacher = "", assistant = "", status = "", days = "", kind = "" },
    hideFinance = false,
  ) => {
    const trimmedSearch = search?.trim();
    const baseFilter = { client: clientId, isDeleted: false };
    const kindFilter = kindFilterOf(kind);
    if (kindFilter) baseFilter.kind = kindFilter;
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

      // Individual guruhda qidiruv o'quvchi ismi/telefoni bo'yicha ham.
      const individualMap = await getIndividualStudentMap(clientId, all);
      const matchesStudent = (g) => {
        const st = individualMap[String(g._id)];
        return !!st && (regex.test(st.fullName || "") || regex.test(st.phone || ""));
      };

      const data = all.filter(
        (g) =>
          regex.test(subjectMap[String(g.subject)] || "") ||
          (g.teacher && regex.test(teacherMap[String(g.teacher)] || "")) ||
          matchesStudent(g),
      );

      return {
        data: await buildDTOs(clientId, data, hideFinance),
        meta: { page: 1, limit: data.length, total: data.length, totalPages: 1 },
      };
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const skip = (pageNum - 1) * PAGE_SIZE;

    const [data, total] = await Promise.all([
      Group.find(baseFilter).sort({ createdAt: -1 }).skip(skip).limit(PAGE_SIZE),
      Group.countDocuments(baseFilter),
    ]);

    return {
      data: await buildDTOs(clientId, data, hideFinance),
      meta: {
        page: pageNum,
        limit: PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / PAGE_SIZE) || 1,
      },
    };
  },

  getOne: async (clientId, id, hideFinance = false) => {
    const group = await Group.findOne({ _id: id, client: clientId, isDeleted: false });
    if (!group) throw new Error("group.notFound");

    const [dto] = await buildDTOs(clientId, [group], hideFinance);
    return dto;
  },

  // Excel export — list() bilan bir xil filtr, sahifalashsiz, Filial/Fan/
  // O'qituvchi nomi hal qilingan holda.
  exportList: async (clientId, { search = "", center = "", teacher = "", status = "", days = "" }) => {
    const trimmedSearch = search?.trim();
    // Groups sahifasi kabi — individual guruhlar eksportga tushmaydi.
    const baseFilter = { client: clientId, isDeleted: false, kind: NOT_INDIVIDUAL };
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
  // O'qituvchi o'zining guruhini tahrirlashi mumkin, lekin FAQAT yordamchi
  // o'qituvchi maydonini — fan, xona, kunlar, vaqt uni tegishli emas
  // (frontend `GroupScheduleDialog` bu maydonlarni teacher uchun qulflab
  // qo'yadi, bu yerda esa yakuniy kafolat: boshqa maydonlar jimgina
  // e'tiborsiz qoldiriladi, xato tashlanmaydi).
  reschedule: async (clientId, id, body = {}, staff = null) => {
    const group = await Group.findOne({ _id: id, client: clientId, isDeleted: false });
    if (!group) throw new Error("group.notFound");
    // Ish maydonida pending ("Start berilgan") guruhlar ham bor va ularga
    // jadval qo'yish mumkin. Faqat yakunlangan guruh jadvali o'zgarmaydi.
    if (group.status === "finished") throw new Error("group.scheduleFinished");

    const isTeacherScoped = staff?.role === "teacher";
    const fields = isTeacherScoped
      ? { teacherId: undefined, assistantId: body.assistantId, roomId: undefined, days: undefined, startTime: undefined, endTime: undefined }
      : body;
    const { teacherId, roomId, days, startTime, endTime } = fields;
    // Individual guruhda yordamchi o'qituvchi bo'lmaydi — maydon e'tiborsiz.
    const assistantId = group.kind === "individual" ? undefined : fields.assistantId;
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
    // `roomId: null` — guruhni jadvaldan olib tashlash (bo'shatish),
    // `undefined` esa "tegilmasin" degani. Bo'shatishda xona to'qnashuvini
    // tekshirish MA'NOSIZ (guruh jadvaldan chiqarilyapti).
    const nextRoom =
      roomId !== undefined
        ? room
        : await Room.findOne({ _id: group.room, isDeleted: false });

    // Individual guruhda xona to'qnashuvi tekshirilmaydi (kontrakt §0.4).
    if (group.kind !== "individual" && (roomId === undefined || room)) {
      await checkRoomConflict(
        clientId,
        group.center,
        nextRoom,
        nextDays,
        nextStartTime,
        nextEndTime,
        group._id,
      );
    }

    if (teacher) group.teacher = teacher._id;
    if (roomId !== undefined) group.room = room ? room._id : null;
    if (days) group.days = days;
    if (startTime !== undefined) group.startTime = startTime;
    if (endTime !== undefined) group.endTime = endTime;
    await group.save();
    emitGroupChanged(clientId, group, "updated");

    const countMap = await getStudentsCountMap([group._id]);
    return DTO(group, countMap[String(group._id)] || 0);
  },

  rename: async (clientId, id, name) => {
    const trimmed = (name || "").trim();
    if (!trimmed) throw new Error("group.invalidName");

    const group = await Group.findOne({ _id: id, client: clientId, isDeleted: false });
    if (!group) throw new Error("group.notFound");

    group.name = trimmed;
    await group.save();
    emitGroupChanged(clientId, group, "renamed");

    const countMap = await getStudentsCountMap([group._id]);
    return DTO(group, countMap[String(group._id)] || 0);
  },

  // Telegram guruh manzili — bo'sh/null → o'chiriladi. Aks holda
  // `normalizeTelegramLink` orqali `https://t.me/<path>` ga keltiriladi.
  setTelegramLink: async (clientId, id, link) => {
    const normalized = normalizeTelegramLink(link);
    if (normalized === undefined) throw new Error("group.invalidTelegramLink");

    const group = await Group.findOne({ _id: id, client: clientId, isDeleted: false });
    if (!group) throw new Error("group.notFound");

    group.telegramLink = normalized;
    await group.save();
    emitGroupChanged(clientId, group, "telegram", { telegramLink: group.telegramLink || null });

    const countMap = await getStudentsCountMap([group._id]);
    return DTO(group, countMap[String(group._id)] || 0);
  },

  // Jadval sahifasining ma'lumot bazasi. Saqlash har bir guruh uchun alohida
  // `reschedule` (yuqorida) orqali boradi — API_CONTRACT_group_schedule_per_group.md.
  scheduleData: async (clientId, staffCenter = "") => buildScheduleData(clientId, staffCenter),

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

  // Arxivlash — API_CONTRACT_archive.md. Guruh HOLATIDAN qat'i nazar
  // (pending/active/finished) arxivlanadi. "O'chirish" tushunchasi yo'q:
  // `isDeleted` endi "arxivda" degani, hujjat hech qachon yo'qolmaydi va
  // Arxiv bo'limidan qaytarilishi mumkin.
  archive: async (clientId, id, actor = null) => {
    const group = await Group.findOne({ _id: id, client: clientId, isDeleted: false });
    if (!group) throw new Error("group.notFound");

    group.isDeleted = true;
    group.deletedAt = getNow();
    await group.save();

    // Guruh bilan birga uning o'quvchi a'zoliklari ham arxivlanadi — shu
    // bilan arxivlangan guruh qarzdorligi butun loyihadan chiqadi.
    const entriesArchived = await archiveGroupEntries(group._id);

    emitGroupChanged(clientId, group, "archived");
    emitArchiveChanged(clientId, group.center, "group", group._id, "archived");

    const subject = await Subject.findById(group.subject).select("name");
    void audit.log({
      actor,
      client: clientId,
      center: group.center,
      action: "group:archived",
      entity: { type: "group", id: group._id, label: group.name || subject?.name || "" },
      meta: { entriesArchived },
    });

    return true;
  },
};

function maxStudentsInvalid(body) {
  return body.maxStudents !== undefined && body.maxStudents != null && body.maxStudents < 0;
}
