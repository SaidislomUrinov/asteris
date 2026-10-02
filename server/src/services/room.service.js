const Room = require("../models/Room");
const Center = require("../models/Center");
const Group = require("../models/Group");
const Subject = require("../models/Subject");
const Staff = require("../models/Staff");
const Student = require("../models/Student");
const { getNow } = require("../utils/date.util");
const audit = require("../utils/audit.util");
const { emitArchiveChanged } = require("../utils/archive.util");

const PAGE_SIZE = 50;

const DTO = (data, groupsCount = 0, studentsCount = 0) => ({
  _id: data?._id,
  client: data?.client,
  center: data?.center,
  name: data?.name,
  capacity: data?.capacity,
  status: data?.status,
  groupsCount,
  studentsCount,
  date: data?.date,
  lastUpdate: data?.lastUpdate,
});

// Bir nechta xona uchun bitta so'rovda: nechta tugallanmagan (pending/active)
// guruh biriktirilgani + shu guruhlardagi jami faol o'quvchilar soni — Rooms
// ro'yxati (card grid) shu bilan to'ldiriladi.
const getRoomStatsMap = async (roomIds) => {
  if (!roomIds.length) return {};

  const groups = await Group.find(
    { room: { $in: roomIds }, isDeleted: false, status: { $in: ["pending", "active"] } },
    { room: 1 },
  );
  if (!groups.length) return {};

  const groupIds = groups.map((g) => g._id);
  const groupsByRoom = {};
  for (const g of groups) {
    const key = String(g.room);
    (groupsByRoom[key] ||= []).push(String(g._id));
  }

  const countRows = await Student.aggregate([
    { $match: { "groups.group": { $in: groupIds } } },
    { $unwind: "$groups" },
    { $match: { "groups.group": { $in: groupIds }, "groups.status": "active" } },
    { $group: { _id: "$groups.group", count: { $sum: 1 } } },
  ]);
  const studentsByGroup = Object.fromEntries(countRows.map((r) => [String(r._id), r.count]));

  const stats = {};
  for (const [roomId, ids] of Object.entries(groupsByRoom)) {
    stats[roomId] = {
      groupsCount: ids.length,
      studentsCount: ids.reduce((sum, gid) => sum + (studentsByGroup[gid] || 0), 0),
    };
  }
  return stats;
};

module.exports = {
  DTO,

  create: async (clientId, body) => {
    const { centerId, name, capacity } = body;
    if (!centerId || !name) throw new Error("room.fillTheRows");

    const center = await Center.findOne({ _id: centerId, client: clientId, isDeleted: false });
    if (!center) throw new Error("center.notFound");

    const room = await Room.create({
      client: clientId,
      center: center._id,
      name: name.trim(),
      capacity: capacity ?? null,
    });

    return DTO(room);
  },

  /**
   * Tanlov ro'yxati (lookup) — guruh yaratish/faollashtirish, jadval kabi
   * oynalarda xona TANLASH uchun. `room:view` ruxsatini TALAB QILMAYDI:
   * o'qituvchi/yordamchi bu ruxsatni printsipial ololmaydi (whitelist uni
   * kesib tashlaydi), lekin guruhni faollashtirishda xona ko'rsatishi shart.
   * Shu sabab bu yerda faqat ENG ZARUR maydonlar qaytadi — statistika,
   * sig'im tafsilotlari va boshqa boshqaruv ma'lumotlari yo'q.
   * Filial izolatsiyasi `tenantAuth` bergan `center` orqali saqlanadi.
   */
  lookup: async (clientId, { center = "" }) => {
    const filter = { client: clientId, isDeleted: false };
    if (center) filter.center = center;
    const rooms = await Room.find(filter).select("name center").sort({ name: 1 }).lean();
    return rooms.map((r) => ({
      _id: String(r._id),
      name: r.name,
      center: String(r.center),
    }));
  },

  list: async (clientId, { page = 1, search = "", center = "" }) => {
    const trimmedSearch = search?.trim();
    const baseFilter = { client: clientId, isDeleted: false };
    if (center) baseFilter.center = center;

    if (trimmedSearch) {
      const regex = new RegExp(trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const data = await Room.find({ ...baseFilter, name: regex }).sort({ createdAt: -1 });
      const statsMap = await getRoomStatsMap(data.map((r) => r._id));

      return {
        data: data.map((r) => {
          const s = statsMap[String(r._id)];
          return DTO(r, s?.groupsCount || 0, s?.studentsCount || 0);
        }),
        meta: { page: 1, limit: data.length, total: data.length, totalPages: 1 },
      };
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const skip = (pageNum - 1) * PAGE_SIZE;

    const [data, total] = await Promise.all([
      Room.find(baseFilter).sort({ createdAt: -1 }).skip(skip).limit(PAGE_SIZE),
      Room.countDocuments(baseFilter),
    ]);
    const statsMap = await getRoomStatsMap(data.map((r) => r._id));

    return {
      data: data.map((r) => {
        const s = statsMap[String(r._id)];
        return DTO(r, s?.groupsCount || 0, s?.studentsCount || 0);
      }),
      meta: {
        page: pageNum,
        limit: PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / PAGE_SIZE) || 1,
      },
    };
  },

  getOne: async (clientId, id) => {
    const room = await Room.findOne({ _id: id, client: clientId, isDeleted: false });
    if (!room) throw new Error("room.notFound");
    const statsMap = await getRoomStatsMap([room._id]);
    const s = statsMap[String(room._id)];
    return DTO(room, s?.groupsCount || 0, s?.studentsCount || 0);
  },

  // Xona detail sahifasi uchun — bu xonadagi (tugallanmagan: pending/active)
  // guruhlar ro'yxati fan/o'qituvchi nomi va o'quvchilar soni bilan birga,
  // shu asosda frontendda haftalik jadval (band/bo'sh soatlar) chiziladi.
  // Yakunlangan (finished) guruhlar xona jadvalini band qilmaydi.
  schedule: async (clientId, id) => {
    const room = await Room.findOne({ _id: id, client: clientId, isDeleted: false });
    if (!room) throw new Error("room.notFound");

    const groups = await Group.find({
      client: clientId,
      room: room._id,
      isDeleted: false,
      status: { $in: ["pending", "active"] },
    }).sort({ startTime: 1 });

    const subjectIds = [...new Set(groups.map((g) => String(g.subject)))];
    const teacherIds = [...new Set(groups.filter((g) => g.teacher).map((g) => String(g.teacher)))];
    const [subjects, teachers] = await Promise.all([
      Subject.find({ _id: { $in: subjectIds } }),
      Staff.find({ _id: { $in: teacherIds } }),
    ]);
    const subjectMap = Object.fromEntries(subjects.map((s) => [String(s._id), s.name]));
    const teacherMap = Object.fromEntries(teachers.map((s) => [String(s._id), s.name]));

    const groupIds = groups.map((g) => g._id);
    const countRows = groupIds.length
      ? await Student.aggregate([
          { $match: { "groups.group": { $in: groupIds } } },
          { $unwind: "$groups" },
          { $match: { "groups.group": { $in: groupIds }, "groups.status": "active" } },
          { $group: { _id: "$groups.group", count: { $sum: 1 } } },
        ])
      : [];
    const countMap = Object.fromEntries(countRows.map((r) => [String(r._id), r.count]));

    const groupList = groups.map((g) => ({
      _id: g._id,
      label: subjectMap[String(g.subject)] || "?",
      teacher: teacherMap[String(g.teacher)] || "",
      status: g.status,
      pendingId: g.pendingId,
      activeId: g.activeId,
      days: g.days,
      startTime: g.startTime,
      endTime: g.endTime,
      studentsCount: countMap[String(g._id)] || 0,
    }));

    return {
      room: DTO(room),
      groupsCount: groupList.length,
      studentsCount: groupList.reduce((sum, g) => sum + g.studentsCount, 0),
      groups: groupList,
    };
  },

  // Excel export — list() bilan bir xil filtr, sahifalashsiz, Filial nomi
  // hal qilingan holda.
  exportList: async (clientId, { search = "", center = "" }) => {
    const trimmedSearch = search?.trim();
    const baseFilter = { client: clientId, isDeleted: false };
    if (center) baseFilter.center = center;
    if (trimmedSearch) {
      const regex = new RegExp(trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      baseFilter.name = regex;
    }

    const rooms = await Room.find(baseFilter).sort({ createdAt: -1 });
    const statsMap = await getRoomStatsMap(rooms.map((r) => r._id));

    const centerIds = [...new Set(rooms.map((r) => String(r.center)))];
    const centers = await Center.find({ _id: { $in: centerIds } }, { name: 1 });
    const centerMap = Object.fromEntries(centers.map((c) => [String(c._id), c.name]));

    return rooms.map((r) => {
      const s = statsMap[String(r._id)];
      return {
        name: r.name,
        centerName: centerMap[String(r.center)] || "—",
        groupsCount: s?.groupsCount || 0,
        studentsCount: s?.studentsCount || 0,
        capacity: r.capacity,
        status: r.status,
      };
    });
  },

  update: async (clientId, id, body) => {
    const room = await Room.findOne({ _id: id, client: clientId, isDeleted: false });
    if (!room) throw new Error("room.notFound");

    if (body.name) room.name = body.name.trim();
    if (body.capacity !== undefined) room.capacity = body.capacity;
    if (body.status && ["active", "inactive"].includes(body.status)) room.status = body.status;

    if (body.centerId) {
      const center = await Center.findOne({
        _id: body.centerId,
        client: clientId,
        isDeleted: false,
      });
      if (!center) throw new Error("center.notFound");
      room.center = center._id;
    }

    await room.save();
    return DTO(room);
  },

  // Arxivlash — API_CONTRACT_archive.md. Bog'langan guruhlar TEGILMAYDI
  // (kaskad yo'q), guruhda xona bog'lanishi shunchaki bo'sh ko'rinadi.
  remove: async (clientId, id, actor = null) => {
    const room = await Room.findOne({ _id: id, client: clientId, isDeleted: false });
    if (!room) throw new Error("room.notFound");

    room.isDeleted = true;
    room.deletedAt = getNow();
    await room.save();

    emitArchiveChanged(clientId, room.center, "room", room._id, "archived");
    void audit.log({
      actor,
      client: clientId,
      center: room.center,
      action: "room:archived",
      entity: { type: "room", id: room._id, label: room.name },
    });

    return true;
  },
};
