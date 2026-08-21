const groupService = require("../services/group.service");
const { sendExcel, THEME } = require("../utils/excel.util");
const emit = require("../utils/emitter.util");

const DAY_LABELS = { mon: "Dushanba", tue: "Seshanba", wed: "Chorshanba", thu: "Payshanba", fri: "Juma", sat: "Shanba", sun: "Yakshanba" };
const STATUS_LABELS = { pending: "Yig'ilmoqda", active: "Faol", finished: "Tugagan" };

// Qoralama egasi: Staff bo'lsa o'zi, aks holda Client Owner.
const actorId = (req) => String(req.staff?._id || req.client._id);

module.exports = {
  // ─── Ommaviy qayta tartiblash ("Tartiblash") ──────────────────────────
  // API_CONTRACT_group_reschedule.md. Qoralama egasi = amal qilayotgan
  // foydalanuvchi, shuning uchun ikki administrator bir-birini buzmaydi.

  rescheduleStart: async (req, res, next) => {
    try {
      const data = await groupService.rescheduleStart(
        req.client._id,
        actorId(req),
        req.staff?.center || "",
      );
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  rescheduleGet: async (req, res, next) => {
    try {
      const data = await groupService.rescheduleGet(req.client._id, actorId(req));
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  reschedulePlace: async (req, res, next) => {
    try {
      const data = await groupService.reschedulePlace(req.client._id, actorId(req), req.body);
      return res.send({ ok: true, data });
    } catch (error) {
      // Konflikt `error.conflict` bilan keladi va utils/error.util.js uni
      // javobga o'zi qo'shadi — GroupScheduleDialog allaqachon shu shaklni
      // kutadi, shuning uchun maxsus ishlov kerak emas.
      next(error);
    }
  },

  rescheduleUnplace: async (req, res, next) => {
    try {
      const data = await groupService.rescheduleUnplace(
        req.client._id,
        actorId(req),
        req.params.groupId,
      );
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  scheduleData: async (req, res, next) => {
    try {
      const data = await groupService.scheduleData(req.client._id, req.staff?.center || "");
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  rescheduleCommit: async (req, res, next) => {
    try {
      const data = await groupService.rescheduleCommit(
        req.client._id,
        actorId(req),
        req.body,
        req.staff?.center || "",
      );
      emit(`client:${req.client._id}`, "group:rescheduled", { count: data.updated });
      return res.send({ ok: true, data, msg: "group.rescheduleApplied" });
    } catch (error) {
      next(error);
    }
  },

  rescheduleDiscard: async (req, res, next) => {
    try {
      await groupService.rescheduleDiscard(req.client._id, actorId(req));
      return res.send({ ok: true, data: null });
    } catch (error) {
      next(error);
    }
  },

  create: async (req, res, next) => {
    try {
      const data = await groupService.create(req.client._id, req.body);
      return res.send({ ok: true, data, msg: "group.created" });
    } catch (error) {
      next(error);
    }
  },

  list: async (req, res, next) => {
    try {
      const { page, search, center, teacher, assistant, status, days } = req.query;
      const { data, meta } = await groupService.list(req.client._id, {
        page,
        search,
        center,
        teacher,
        assistant,
        status,
        days,
      });
      return res.send({ ok: true, data, meta });
    } catch (error) {
      next(error);
    }
  },

  getOne: async (req, res, next) => {
    try {
      const data = await groupService.getOne(req.client._id, req.params.id);
      // O'qituvchi guruh NARXINI ko'rmaydi (moliyaviy ma'lumot —
      // utils/teacherView.util.js bilan bir xil tamoyil).
      if (req.staff?.role === "teacher" && data) {
        const { price, ...rest } = data;
        return res.send({ ok: true, data: rest });
      }
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  exportList: async (req, res, next) => {
    try {
      const { search, center, teacher, status, days } = req.query;
      const rows = await groupService.exportList(req.client._id, { search, center, teacher, status, days });
      await sendExcel(res, "guruhlar", [
        {
          sheetName: "Guruhlar",
          color: THEME.group,
          title: "Guruhlar ro'yxati",
          subtitle: `Jami: ${rows.length} ta`,
          columns: [
            { header: "Nomi", width: 22, value: (r) => r.label },
            { header: "Filial", width: 20, value: (r) => r.centerName },
            { header: "O'qituvchi", width: 20, value: (r) => r.teacherName || "—" },
            { header: "Kunlar", width: 26, value: (r) => r.days.map((d) => DAY_LABELS[d] || d).join(", ") || "—" },
            { header: "Vaqti", width: 16, value: (r) => (r.startTime ? `${r.startTime}–${r.endTime}` : "—") },
            { header: "Holat", width: 14, value: (r) => STATUS_LABELS[r.status] || r.status },
            { header: "O'quvchilar", width: 14, align: "right", value: (r) => r.studentsCount },
          ],
          rows,
        },
      ]);
    } catch (error) {
      next(error);
    }
  },

  exportOne: async (req, res, next) => {
    try {
      const { group, rows } = await groupService.exportOne(req.client._id, req.params.id);
      const label = `${group.status === "pending" ? group.pendingId : group.activeId}`;
      await sendExcel(res, `guruh_${label}`, [
        {
          sheetName: "O'quvchilar",
          color: THEME.group,
          title: `Guruh — ${label}`,
          subtitle: `Jami: ${rows.length} ta o'quvchi`,
          columns: [
            { header: "F.I.Sh.", width: 26, value: (r) => r.fullName },
            { header: "Telefon", width: 18, value: (r) => r.phone },
            { header: "Narx (so'm)", width: 16, align: "right", numFmt: "#,##0", value: (r) => r.price },
            { header: "Holat", width: 14, value: (r) => (r.status === "active" ? "O'qimoqda" : "Chiqarilgan") },
            { header: "To'langan (joriy)", width: 18, align: "right", numFmt: "#,##0", value: (r) => r.paid },
            { header: "Jami (joriy)", width: 16, align: "right", numFmt: "#,##0", value: (r) => r.due },
            { header: "Qarzdorlik", width: 16, align: "right", numFmt: "#,##0", value: (r) => r.debt },
          ],
          rows,
        },
      ]);
    } catch (error) {
      next(error);
    }
  },

  activate: async (req, res, next) => {
    try {
      const data = await groupService.activate(req.client._id, req.params.id, req.body);
      return res.send({ ok: true, data, msg: "group.activated" });
    } catch (error) {
      next(error);
    }
  },

  reschedule: async (req, res, next) => {
    try {
      const data = await groupService.reschedule(req.client._id, req.params.id, req.body);
      return res.send({ ok: true, data, msg: "group.rescheduled" });
    } catch (error) {
      next(error);
    }
  },

  finish: async (req, res, next) => {
    try {
      const data = await groupService.finish(req.client._id, req.params.id);
      return res.send({ ok: true, data, msg: "group.finished" });
    } catch (error) {
      next(error);
    }
  },
};
