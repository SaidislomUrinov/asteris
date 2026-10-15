const { Types } = require("mongoose");
const StudentLead = require("../models/StudentLead");
const Center = require("../models/Center");
const Subject = require("../models/Subject");
const Group = require("../models/Group");
const Student = require("../models/Student");
const groupService = require("./group.service");
const studentService = require("./student.service");
const emit = require("../utils/emitter.util");
const audit = require("../utils/audit.util");
const moment = require("moment-timezone");
const { getNow, currentMonthString } = require("../utils/date.util");
const {
  applyTelegramFields,
  telegramFieldsOf,
  hasTelegramFields,
} = require("../utils/telegramPhone.util");

// API_CONTRACT_student_leads.md
const PAGE_SIZE = 50;
const OPEN_STATUSES = ["new", "contacted"];
const PHONE_RE = /^\+998\d{9}$/;

const DTO = (lead) => ({
  _id: lead?._id,
  center: lead?.center,
  subject: lead?.subject,
  fullName: lead?.fullName,
  phone: lead?.phone,
  parentPhone: lead?.parentPhone,
  ...telegramFieldsOf(lead),
  preferredDays: lead?.preferredDays || [],
  preferredTime: lead?.preferredTime,
  level: lead?.level,
  source: lead?.source,
  note: lead?.note,
  status: lead?.status,
  student: lead?.student || null,
  group: lead?.group || null,
  enrolledAt: lead?.enrolledAt || null,
  createdBy: { name: lead?.createdBy?.name || "", kind: lead?.createdBy?.kind || "" },
  createdAt: lead?.createdAt,
  date: lead?.date,
});

// Lid → yangi o'quvchi: `*Same === false` bo'lsagina raqam uzatiladi.
const leadTelegramBody = (lead) => {
  const t = telegramFieldsOf(lead);
  return {
    telegramSame: t.telegramSame,
    ...(t.telegramSame ? {} : { telegramPhone: t.telegramPhone }),
    parentTelegramSame: t.parentTelegramSame,
    ...(t.parentTelegramSame ? {} : { parentTelegramPhone: t.parentTelegramPhone }),
  };
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const notify = (clientId, centerIds, action, ids) => {
  const payload = { action, ids: ids.map(String) };
  emit(`client:${clientId}`, "lead:changed", payload);
  [...new Set(centerIds.map(String))].forEach((c) => emit(`center:${c}`, "lead:changed", payload));
};

// Yaratish va tahrirlashda umumiy maydonlar — faqat yuborilganlari tekshiriladi.
const pickFields = (body, { partial }) => {
  const out = {};
  if (!partial || body.fullName !== undefined) {
    if (!body.fullName?.trim()) throw new Error("lead.fillTheRows");
    out.fullName = body.fullName.trim();
  }
  if (!partial || body.phone !== undefined) {
    const phone = String(body.phone || "").trim();
    if (!PHONE_RE.test(phone)) throw new Error("lead.invalidPhone");
    out.phone = phone;
  }
  if (body.parentPhone !== undefined) {
    const p = String(body.parentPhone || "").trim();
    if (p && !PHONE_RE.test(p)) throw new Error("lead.invalidPhone");
    out.parentPhone = p;
  }
  if (body.preferredDays !== undefined) {
    const days = Array.isArray(body.preferredDays) ? body.preferredDays : [];
    if (days.some((d) => !StudentLead.DAYS.includes(d))) throw new Error("lead.invalidValue");
    out.preferredDays = [...new Set(days)];
  }
  if (body.preferredTime !== undefined) {
    if (!StudentLead.TIMES.includes(body.preferredTime)) throw new Error("lead.invalidValue");
    out.preferredTime = body.preferredTime;
  }
  if (body.source !== undefined) {
    if (!StudentLead.SOURCES.includes(body.source)) throw new Error("lead.invalidValue");
    out.source = body.source;
  }
  if (body.level !== undefined) out.level = String(body.level || "").trim().slice(0, 60);
  if (body.note !== undefined) out.note = String(body.note || "").trim().slice(0, 500);
  return out;
};

const validateCenterSubject = async (clientId, centerId, subjectId) => {
  if (!centerId || !subjectId) throw new Error("lead.fillTheRows");
  if (!Types.ObjectId.isValid(centerId) || !Types.ObjectId.isValid(subjectId)) {
    throw new Error("lead.fillTheRows");
  }
  const center = await Center.findOne({ _id: centerId, client: clientId, isDeleted: false });
  if (!center) throw new Error("center.notFound");
  const subject = await Subject.findOne({ _id: subjectId, client: clientId, center: center._id, isDeleted: false });
  if (!subject) throw new Error("subject.notFound");
  return { center, subject };
};

const buildFilter = (clientId, { search, center, subject, status, days, time, level, source }) => {
  const filter = { client: clientId, isDeleted: false };
  if (center) filter.center = center;
  if (subject) filter.subject = subject;
  if (status === "all") {
    // hech qanday cheklov yo'q
  } else if (StudentLead.STATUSES.includes(status)) {
    filter.status = status;
  } else {
    filter.status = { $in: OPEN_STATUSES };
  }
  if (source && StudentLead.SOURCES.includes(source)) filter.source = source;
  // "Kechqurun" qidirilsa, vaqti "farqi yo'q" bo'lganlar ham mos keladi.
  if (time && StudentLead.TIMES.includes(time) && time !== "any") {
    filter.preferredTime = { $in: [time, "any"] };
  }
  const and = [];
  const dayList = String(days || "")
    .split(",")
    .filter((d) => StudentLead.DAYS.includes(d));
  // Kun tanlanmagan lid "farqi yo'q" deb hisoblanadi — u ham mos keladi.
  if (dayList.length) {
    and.push({ $or: [{ preferredDays: { $in: dayList } }, { preferredDays: { $size: 0 } }] });
  }
  if (level?.trim()) filter.level = new RegExp(escapeRegex(level.trim()), "i");
  if (search?.trim()) {
    const regex = new RegExp(escapeRegex(search.trim()), "i");
    and.push({ $or: [{ fullName: regex }, { phone: regex }, { parentPhone: regex }] });
  }
  if (and.length) filter.$and = and;
  return filter;
};

module.exports = {
  DTO,

  list: async (clientId, query) => {
    const filter = buildFilter(clientId, query);
    const pageNum = Math.max(1, Number(query.page) || 1);

    const [data, total] = await Promise.all([
      StudentLead.find(filter)
        .sort({ createdAt: 1 })
        .skip((pageNum - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE),
      StudentLead.countDocuments(filter),
    ]);

    return {
      data: data.map(DTO),
      meta: { page: pageNum, limit: PAGE_SIZE, total, totalPages: Math.ceil(total / PAGE_SIZE) || 1 },
    };
  },

  summary: async (clientId, { center = "" }) => {
    const rows = await StudentLead.aggregate([
      {
        $match: {
          client: new Types.ObjectId(String(clientId)),
          ...(center ? { center: new Types.ObjectId(String(center)) } : {}),
          isDeleted: false,
          status: { $in: OPEN_STATUSES },
        },
      },
      { $group: { _id: "$subject", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    return rows.map((r) => ({ subject: r._id, count: r.count }));
  },

  // Dashboard donut'i — tanlangan oyda (Asia/Tashkent) KELGAN lidlar, joriy
  // holati bo'yicha va fan kesimida (API_CONTRACT_student_leads.md §2.7).
  monthStats: async (clientId, { month = "", center = "" }) => {
    const m = /^\d{4}-\d{2}$/.test(month) ? month : currentMonthString();
    const start = moment.tz(`${m}-01`, "YYYY-MM-DD", "Asia/Tashkent").startOf("month");
    const match = {
      client: new Types.ObjectId(String(clientId)),
      ...(center ? { center: new Types.ObjectId(String(center)) } : {}),
      isDeleted: false,
      createdAt: { $gte: start.unix(), $lt: start.clone().add(1, "month").unix() },
    };
    const [byStatus, bySubject] = await Promise.all([
      StudentLead.aggregate([{ $match: match }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
      StudentLead.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$subject",
            total: { $sum: 1 },
            enrolled: { $sum: { $cond: [{ $eq: ["$status", "enrolled"] }, 1, 0] } },
          },
        },
        { $sort: { total: -1 } },
      ]),
    ]);
    const status = Object.fromEntries(StudentLead.STATUSES.map((s) => [s, 0]));
    byStatus.forEach((r) => (status[r._id] = r.count));
    return {
      month: m,
      total: Object.values(status).reduce((a, b) => a + b, 0),
      byStatus: status,
      bySubject: bySubject.map((r) => ({ subject: r._id, total: r.total, enrolled: r.enrolled })),
    };
  },

  create: async (clientId, body, actor) => {
    const fields = pickFields(body, { partial: false });
    const { center, subject } = await validateCenterSubject(clientId, body.centerId, body.subjectId);

    // Telegram raqamlari (API_CONTRACT_telegram_phone.md §1) — Student bilan
    // bir xil invariant, bitta helper orqali.
    applyTelegramFields(fields, body, { isNew: true, errorKey: "lead.invalidTelegramPhone" });

    const lead = await StudentLead.create({
      ...fields,
      client: clientId,
      center: center._id,
      subject: subject._id,
      createdBy: { id: actor?.id || null, kind: actor?.kind || "", name: actor?.name || "" },
    });

    notify(clientId, [center._id], "created", [lead._id]);
    audit.log({
      actor,
      client: clientId,
      center: center._id,
      action: "lead:create",
      entity: { type: "lead", id: lead._id, label: lead.fullName },
    });
    return DTO(lead);
  },

  update: async (clientId, id, body, actor) => {
    const lead = await StudentLead.findOne({ _id: id, client: clientId, isDeleted: false });
    if (!lead) throw new Error("lead.notFound");
    if (lead.status === "enrolled") throw new Error("lead.alreadyEnrolled");

    const fields = pickFields(body, { partial: true });
    if (body.subjectId !== undefined || body.centerId !== undefined) {
      const { center, subject } = await validateCenterSubject(
        clientId,
        body.centerId || lead.center,
        body.subjectId || lead.subject,
      );
      fields.center = center._id;
      fields.subject = subject._id;
    }
    if (body.status !== undefined) {
      if (!["new", "contacted", "rejected"].includes(body.status)) throw new Error("lead.invalidValue");
      fields.status = body.status;
    }

    const before = lead.toObject();
    Object.assign(lead, fields);
    // phone/parentPhone yuqorida o'rnatilgan — `*Same` bo'lsa qayta sinxronlanadi.
    applyTelegramFields(lead, body, { isNew: false, errorKey: "lead.invalidTelegramPhone" });
    const telegramKeys = hasTelegramFields(body) || fields.phone !== undefined || fields.parentPhone !== undefined
      ? ["telegramSame", "telegramPhone", "parentTelegramSame", "parentTelegramPhone"]
      : [];
    await lead.save();

    notify(clientId, [before.center, lead.center], "updated", [lead._id]);
    audit.log({
      actor,
      client: clientId,
      center: lead.center,
      action: "lead:update",
      entity: { type: "lead", id: lead._id, label: lead.fullName },
      changes: audit.diff(before, lead.toObject(), [...Object.keys(fields), ...telegramKeys]),
    });
    return DTO(lead);
  },

  remove: async (clientId, id, actor) => {
    const lead = await StudentLead.findOne({ _id: id, client: clientId, isDeleted: false });
    if (!lead) throw new Error("lead.notFound");
    lead.isDeleted = true;
    lead.deletedAt = getNow();
    await lead.save();

    notify(clientId, [lead.center], "deleted", [lead._id]);
    audit.log({
      actor,
      client: clientId,
      center: lead.center,
      action: "lead:delete",
      entity: { type: "lead", id: lead._id, label: lead.fullName },
    });
    return DTO(lead);
  },

  // Tanlangan lidlarni yangi (darhol aktiv) yoki mavjud guruhga qo'shadi.
  // Guruh va o'quvchi mantig'i QAYTA YOZILMAYDI — group.service/student.service
  // chaqiriladi (xona to'qnashuvi, tarif limiti, kreditlar, socketlar o'sha yerda).
  enroll: async (clientId, body, { staff = null, centerScope = null, actor = null } = {}) => {
    const { leadIds, target, groupId, price } = body;
    const ids = [...new Set(Array.isArray(leadIds) ? leadIds.map(String) : [])];
    if (!ids.length || ids.some((i) => !Types.ObjectId.isValid(i))) throw new Error("lead.noneSelected");
    if (!["new", "existing"].includes(target)) throw new Error("lead.invalidValue");
    if (price != null && (Number.isNaN(Number(price)) || Number(price) < 0)) {
      throw new Error("student.invalidPrice");
    }

    const leads = await StudentLead.find({
      _id: { $in: ids },
      client: clientId,
      isDeleted: false,
      ...(centerScope ? { center: centerScope } : {}),
    }).sort({ createdAt: 1 });
    if (leads.length !== ids.length) throw new Error("lead.notFound");
    if (leads.some((l) => !OPEN_STATUSES.includes(l.status))) throw new Error("lead.alreadyEnrolled");

    const centerId = String(leads[0].center);
    const subjectId = String(leads[0].subject);
    if (leads.some((l) => String(l.center) !== centerId || String(l.subject) !== subjectId)) {
      throw new Error("lead.mixedSelection");
    }

    let group;
    if (target === "existing") {
      if (!groupId || !Types.ObjectId.isValid(groupId)) throw new Error("group.notFound");
      const doc = await Group.findOne({
        _id: groupId,
        client: clientId,
        center: centerId,
        subject: subjectId,
        isDeleted: false,
        // Individual guruhga lid yozilmaydi (API_CONTRACT_individual_students.md §3).
        kind: { $ne: "individual" },
      });
      if (!doc) throw new Error("group.notFound");
      if (doc.status === "finished") throw new Error("student.groupFinished");
      group = { _id: doc._id };
    } else {
      const g = body.group || {};
      // Aktivlashtirish uchun majburiy maydonlar — guruh yaratilishidan OLDIN
      // tekshiriladi, aks holda aktivlashmagan "yetim" guruh qolib ketardi.
      if (!g.teacherId || !g.roomId || !g.days?.length || !g.startTime || !g.endTime) {
        throw new Error("group.activationIncomplete");
      }
      if (g.startTime >= g.endTime) throw new Error("lead.invalidTime");

      const created = await groupService.create(
        clientId,
        {
          centerId,
          subjectId,
          teacherId: g.teacherId,
          assistantId: g.assistantId || undefined,
          roomId: g.roomId,
          days: g.days,
          startTime: g.startTime,
          endTime: g.endTime,
          maxStudents: g.maxStudents ?? null,
        },
        staff,
      );
      try {
        await groupService.activate(clientId, created._id, { startDate: g.startDate || undefined });
      } catch (error) {
        // Yangi, bo'sh, hali aktiv bo'lmagan guruh — moliyaviy yozuvi yo'q,
        // shuning uchun to'liq o'chiriladi (arxivga emas).
        await Group.deleteOne({ _id: created._id, status: "pending" });
        emit(`client:${clientId}`, "group:changed", { action: "deleted", groupId: String(created._id) });
        throw error;
      }
      group = { _id: created._id };
    }

    const enrolled = [];
    const failed = [];
    // Ketma-ket — tarif limiti har chaqiruvda bazadan qayta o'qiladi.
    for (const lead of leads) {
      try {
        // Shu clientda telefon VA ism bir xil o'quvchi bo'lsa — dublikat
        // yaratmay, o'sha hujjatga yangi guruh qo'shiladi.
        const existing = await Student.findOne({
          phone: lead.phone,
          fullName: new RegExp(`^${escapeRegex(lead.fullName)}$`, "i"),
          isDeleted: false,
          client: clientId,
        }).select("_id");

        const student = await studentService.create(clientId, {
          fullName: lead.fullName,
          phone: lead.phone,
          parentPhone: lead.parentPhone || undefined,
          // Telegram raqamlari faqat YANGI o'quvchiga ko'chadi — mavjud
          // o'quvchiga biriktirilganda uning Telegram sozlamasi o'zgarmaydi
          // (API_CONTRACT_telegram_phone.md §1). `*Same` bo'lsa ham
          // applyTelegramFields telefon o'zgarishiga qarab qayta sinxronlaydi.
          ...(existing ? {} : leadTelegramBody(lead)),
          centerId,
          groupId: String(group._id),
          price: price != null && price !== "" ? Number(price) : undefined,
          existingStudentId: existing ? String(existing._id) : undefined,
        });

        lead.status = "enrolled";
        lead.student = student._id;
        lead.group = group._id;
        lead.enrolledAt = getNow();
        await lead.save();
        enrolled.push({ leadId: lead._id, studentId: student._id });
      } catch (error) {
        failed.push({ leadId: lead._id, fullName: lead.fullName, msg: error.message });
      }
    }

    if (enrolled.length) notify(clientId, [centerId], "enrolled", enrolled.map((e) => e.leadId));
    audit.log({
      actor,
      client: clientId,
      center: centerId,
      action: "lead:enroll",
      entity: { type: "group", id: group._id, label: "" },
      meta: { target, enrolled: enrolled.length, failed: failed.length },
    });

    const groupDoc = await groupService.getOne(clientId, group._id).catch(() => null);
    return { group: groupDoc || { _id: group._id }, enrolled, failed };
  },
};
