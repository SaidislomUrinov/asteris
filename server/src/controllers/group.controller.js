const groupService = require("../services/group.service");
const { sendExcel, THEME } = require("../utils/excel.util");
const { buildActor } = require("../utils/audit.util");

const DAY_LABELS = { mon: "Dushanba", tue: "Seshanba", wed: "Chorshanba", thu: "Payshanba", fri: "Juma", sat: "Shanba", sun: "Yakshanba" };
const STATUS_LABELS = { pending: "Yig'ilmoqda", active: "Faol", finished: "Tugagan" };

// O'qituvchi/yordamchi individual foizni (moliyaviy) ko'rmaydi.
const hidesFinance = (req) => ["teacher", "assistant"].includes(req.staff?.role);
const forViewer = (req, data) => (data && hidesFinance(req) ? { ...data, teacherPercent: null } : data);

module.exports = {
  // Jadval sahifasining ma'lumot bazasi (guruhlar + xonalar). Saqlash har bir
  // guruh uchun alohida `PATCH /:id/schedule` (pastda `reschedule`) orqali
  // boradi — API_CONTRACT_group_schedule_per_group.md.
  scheduleData: async (req, res, next) => {
    try {
      const data = await groupService.scheduleData(req.client._id, req.staff?.center || "");
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  create: async (req, res, next) => {
    try {
      const data = await groupService.create(req.client._id, req.body, req.staff);
      return res.send({ ok: true, data, msg: "group.created" });
    } catch (error) {
      next(error);
    }
  },

  // Individual o'quvchi qo'shish — yashirin guruh + o'quvchi (API_CONTRACT_individual_students.md §2).
  createIndividual: async (req, res, next) => {
    try {
      const data = await groupService.createIndividual(req.client._id, req.body, buildActor(req));
      return res.status(201).send({ ok: true, data, msg: "student.created" });
    } catch (error) {
      next(error);
    }
  },

  updateIndividual: async (req, res, next) => {
    try {
      const data = await groupService.updateIndividual(req.client._id, req.params.id, req.body, buildActor(req));
      return res.send({ ok: true, data, msg: "individual.updated" });
    } catch (error) {
      next(error);
    }
  },

  list: async (req, res, next) => {
    try {
      const { page, search, center, teacher, assistant, status, days, kind } = req.query;
      const { data, meta } = await groupService.list(
        req.client._id,
        { page, search, center, teacher, assistant, status, days, kind },
        hidesFinance(req),
      );
      return res.send({ ok: true, data, meta });
    } catch (error) {
      next(error);
    }
  },

  getOne: async (req, res, next) => {
    try {
      const data = await groupService.getOne(req.client._id, req.params.id, hidesFinance(req));
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
      const data = await groupService.reschedule(req.client._id, req.params.id, req.body, req.staff);
      return res.send({ ok: true, data: forViewer(req, data), msg: "group.rescheduled" });
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

  // Arxivlash — API_CONTRACT_archive.md. Hujjat o'chmaydi, Arxiv bo'limiga
  // o'tadi va u yerdan qaytarilishi mumkin.
  archive: async (req, res, next) => {
    try {
      await groupService.archive(req.client._id, req.params.id, buildActor(req));
      return res.send({ ok: true, msg: "archive.archived" });
    } catch (error) {
      next(error);
    }
  },

  rename: async (req, res, next) => {
    try {
      const data = await groupService.rename(req.client._id, req.params.id, req.body.name);
      return res.send({ ok: true, data: forViewer(req, data), msg: "group.renamed" });
    } catch (error) {
      next(error);
    }
  },

  // Telegram guruh manzili — `{ telegramLink: string | null | "" }`.
  setTelegramLink: async (req, res, next) => {
    try {
      const data = await groupService.setTelegramLink(
        req.client._id,
        req.params.id,
        req.body?.telegramLink,
      );
      return res.send({ ok: true, data: forViewer(req, data), msg: "group.telegramUpdated" });
    } catch (error) {
      next(error);
    }
  },
};
