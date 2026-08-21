const roomService = require("../services/room.service");
const { sendExcel, THEME } = require("../utils/excel.util");

const DAY_LABELS = { mon: "Dushanba", tue: "Seshanba", wed: "Chorshanba", thu: "Payshanba", fri: "Juma", sat: "Shanba", sun: "Yakshanba" };
const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

module.exports = {
  create: async (req, res, next) => {
    try {
      const data = await roomService.create(req.client._id, req.body);
      return res.send({ ok: true, data, msg: "room.created" });
    } catch (error) {
      next(error);
    }
  },

  list: async (req, res, next) => {
    try {
      const { page, search, center } = req.query;
      const { data, meta } = await roomService.list(req.client._id, { page, search, center });
      return res.send({ ok: true, data, meta });
    } catch (error) {
      next(error);
    }
  },

  getOne: async (req, res, next) => {
    try {
      const data = await roomService.getOne(req.client._id, req.params.id);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  schedule: async (req, res, next) => {
    try {
      const data = await roomService.schedule(req.client._id, req.params.id);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  exportList: async (req, res, next) => {
    try {
      const { search, center } = req.query;
      const rows = await roomService.exportList(req.client._id, { search, center });
      await sendExcel(res, "xonalar", [
        {
          sheetName: "Xonalar",
          color: THEME.room,
          title: "Xonalar ro'yxati",
          subtitle: `Jami: ${rows.length} ta`,
          columns: [
            { header: "Nomi", width: 22, value: (r) => r.name },
            { header: "Filial", width: 20, value: (r) => r.centerName },
            { header: "Guruhlar", width: 14, align: "right", value: (r) => r.groupsCount },
            { header: "O'quvchilar", width: 14, align: "right", value: (r) => r.studentsCount },
            { header: "Sig'imi", width: 12, align: "right", value: (r) => r.capacity ?? "—" },
            { header: "Holat", width: 14, value: (r) => (r.status === "inactive" ? "Nofaol" : "Faol") },
          ],
          rows,
        },
      ]);
    } catch (error) {
      next(error);
    }
  },

  exportSchedule: async (req, res, next) => {
    try {
      const { room, groups } = await roomService.schedule(req.client._id, req.params.id);
      // Har kun uchun bitta qator (haftalik jadval — "qaysi guruh qaysi
      // vaqtga"), kunlar xronologik tartibda guruhlanadi.
      const rows = [];
      DAY_ORDER.forEach((day) => {
        groups
          .filter((g) => g.days?.includes(day))
          .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""))
          .forEach((g) => {
            rows.push({
              day: DAY_LABELS[day],
              label: g.label,
              startTime: g.startTime,
              endTime: g.endTime,
              teacher: g.teacher || "—",
              studentsCount: g.studentsCount,
              status: g.status,
            });
          });
      });

      await sendExcel(res, `xona_${room.name}`, [
        {
          sheetName: "Haftalik jadval",
          color: THEME.room,
          title: `${room.name} — haftalik jadval`,
          subtitle: `Jami: ${groups.length} ta guruh`,
          columns: [
            { header: "Kun", width: 14, value: (r) => r.day },
            { header: "Guruh", width: 22, value: (r) => r.label },
            { header: "Boshlanish", width: 12, value: (r) => r.startTime },
            { header: "Tugash", width: 12, value: (r) => r.endTime },
            { header: "O'qituvchi", width: 20, value: (r) => r.teacher },
            { header: "O'quvchilar", width: 14, align: "right", value: (r) => r.studentsCount },
            {
              header: "Holat",
              width: 16,
              value: (r) => (r.status === "pending" ? "Yig'ilmoqda" : "Faol"),
            },
          ],
          rows,
        },
      ]);
    } catch (error) {
      next(error);
    }
  },

  update: async (req, res, next) => {
    try {
      const data = await roomService.update(req.client._id, req.params.id, req.body);
      return res.send({ ok: true, data, msg: "room.updated" });
    } catch (error) {
      next(error);
    }
  },

  remove: async (req, res, next) => {
    try {
      await roomService.remove(req.client._id, req.params.id);
      return res.send({ ok: true, msg: "room.deleted" });
    } catch (error) {
      next(error);
    }
  },
};
