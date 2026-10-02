const moment = require("moment-timezone");
const { isValidObjectId } = require("mongoose");
const Homework = require("../models/Homework");
const Group = require("../models/Group");
const Staff = require("../models/Staff");
const Client = require("../models/Client");
const emit = require("../utils/emitter.util");
const { log: auditLog } = require("../utils/audit.util");
const { getNow, currentMonthString } = require("../utils/date.util");
const parentNotification = require("./parentNotification.service");

// UYGA VAZIFA — API_CONTRACT_student_role_homework.md §4.
// Guruh + sana bo'yicha BITTA matn; bo'sh matn = soft delete.

const TZ = "Asia/Tashkent";
const MAX_TEXT = 2000;

// "YYYY-MM-DD" va haqiqiy kalendar kuni (2026-02-30 emas).
const isValidDate = (date) =>
  typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) && moment.tz(date, "YYYY-MM-DD", true, TZ).isValid();

// Guruh tenant'ga tegishli bo'lishi shart: client + (staff bo'lsa) o'z filiali
// + (o'qituvchi/assistent bo'lsa) o'z guruhi. Route darajasidagi
// `requireTeacherGroup` ham tekshiradi — servis mustaqil ishonchli bo'lsin.
// `scope` — { centerId, teacher: { id, field } | null }.
const assertGroup = async (clientId, groupId, scope = {}) => {
  if (!isValidObjectId(groupId)) throw new Error("group.notFound");
  const filter = { _id: groupId, client: clientId, isDeleted: false };
  if (scope.centerId) filter.center = scope.centerId;
  const group = await Group.findOne(filter).select("client center teacher assistant name subject status");
  if (!group) throw new Error("group.notFound");
  const t = scope.teacher;
  if (t?.id && String(group[t.field] || "") !== String(t.id)) throw new Error("auth.forbidden");
  return group;
};

// `updatedBy.name` — Staff yoki Client Owner (id + kind), bitta so'rov har tur uchun.
const nameResolver = async (docs) => {
  const ids = (kind) => [
    ...new Set(docs.filter((d) => d.updatedBy?.kind === kind && d.updatedBy?.id).map((d) => String(d.updatedBy.id))),
  ];
  const staffIds = ids("staff");
  const clientIds = ids("client");
  const [staffs, clients] = await Promise.all([
    staffIds.length ? Staff.find({ _id: { $in: staffIds } }).select("name").lean() : [],
    clientIds.length ? Client.find({ _id: { $in: clientIds } }).select("name").lean() : [],
  ]);
  const map = new Map([...staffs, ...clients].map((x) => [String(x._id), x.name || ""]));
  return (by) => (by?.id ? map.get(String(by.id)) || "" : "");
};

const DTO = (h, nameOf) => ({
  _id: String(h._id),
  date: h.date,
  text: h.text,
  updatedAt: h.updatedAt,
  updatedBy: {
    id: h.updatedBy?.id ? String(h.updatedBy.id) : null,
    kind: h.updatedBy?.kind || null,
    name: nameOf(h.updatedBy),
  },
});

// Audit/createdBy uchun amal bajaruvchi (controller'dagi `buildActor(req)`).
const actorRef = (actor) => ({ id: actor?.id || null, kind: actor?.kind === "staff" ? "staff" : "client" });

module.exports = {
  // GET /homework/:groupId?month=YYYY-MM
  listByGroup: async (clientId, groupId, month, scope = {}) => {
    await assertGroup(clientId, groupId, scope);
    const targetMonth = month || currentMonthString();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(targetMonth)) throw new Error("attendance.invalidMonth");

    const items = await Homework.find({
      group: groupId,
      isDeleted: false,
      date: { $gte: `${targetMonth}-01`, $lte: `${targetMonth}-31` },
    })
      .sort({ date: -1 })
      .lean();
    const nameOf = await nameResolver(items);
    return { month: targetMonth, items: items.map((h) => DTO(h, nameOf)) };
  },

  // PUT /homework/:groupId/:date — upsert; bo'sh matn → soft delete.
  // Qaytaradi: { item: DTO | null, deleted: Boolean }.
  set: async (clientId, groupId, date, body, actor, scope = {}) => {
    if (!isValidDate(date)) throw new Error("homework.invalidDate");
    const raw = body?.text;
    if (raw !== undefined && raw !== null && typeof raw !== "string") throw new Error("homework.invalidText");
    const text = String(raw || "").trim();
    if (text.length > MAX_TEXT) throw new Error("homework.tooLong");

    const group = await assertGroup(clientId, groupId, scope);
    // Yakunlangan guruhga vazifa yozilmaydi (a'zolarga xabar ham ketmasin).
    if (group.status === "finished") throw new Error("homework.groupFinished");
    const by = actorRef(actor);
    const now = getNow();
    const existing = await Homework.findOne({ group: group._id, date, isDeleted: false });

    // ── O'chirish ─────────────────────────────────────────────────────────
    if (!text) {
      if (!existing) return { item: null, deleted: true };
      existing.isDeleted = true;
      existing.deletedAt = now;
      existing.updatedBy = by;
      await existing.save();

      await auditLog({
        actor,
        client: clientId,
        center: group.center,
        action: "homework:delete",
        entity: { type: "Homework", id: existing._id, label: date },
        changes: [{ field: "text", from: existing.text, to: null }],
        meta: { groupId: String(group._id), date },
      });
      const nameOf = await nameResolver([existing]);
      emit(`center:${group.center}`, "homework:updated", {
        groupId: String(group._id),
        date,
        text: null,
        updatedAt: existing.updatedAt,
        updatedBy: DTO(existing, nameOf).updatedBy,
      });
      return { item: null, deleted: true };
    }

    // ── Yaratish / yangilash ─────────────────────────────────────────────
    const prevText = existing?.text ?? null;
    let doc = existing;
    if (doc) {
      if (doc.text === text) {
        // O'zgarish yo'q — audit/socket/xabar ham yo'q.
        const nameOf = await nameResolver([doc]);
        return { item: DTO(doc, nameOf), deleted: false };
      }
      doc.text = text;
      doc.updatedBy = by;
      await doc.save();
    } else {
      try {
        doc = await Homework.create({
          client: clientId,
          center: group.center,
          group: group._id,
          date,
          text,
          createdBy: by,
          updatedBy: by,
        });
      } catch (error) {
        // Parallel so'rov shu kunni birinchi yaratib ulgurdi (partial unique
        // index) — o'shani yangilaymiz.
        if (error?.code !== 11000) throw error;
        doc = await Homework.findOne({ group: group._id, date, isDeleted: false });
        if (!doc) throw error;
        doc.text = text;
        doc.updatedBy = by;
        await doc.save();
      }
    }

    await auditLog({
      actor,
      client: clientId,
      center: group.center,
      action: "homework:update",
      entity: { type: "Homework", id: doc._id, label: date },
      changes: [{ field: "text", from: prevText, to: text }],
      meta: { groupId: String(group._id), date },
    });

    const nameOf = await nameResolver([doc]);
    const item = DTO(doc, nameOf);
    emit(`center:${group.center}`, "homework:updated", {
      groupId: String(group._id),
      date,
      text,
      updatedAt: doc.updatedAt,
      updatedBy: item.updatedBy,
    });

    // O'quvchilarga Telegram — kutilmaydi (asosiy amal Telegram'ga bog'lanmasin).
    void parentNotification.onHomework({ group, date, text });

    return { item, deleted: false };
  },
};
