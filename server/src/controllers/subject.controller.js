const subjectService = require("../services/subject.service");
const { sendExcel, THEME } = require("../utils/excel.util");
const { buildActor } = require("../utils/audit.util");

module.exports = {
  create: async (req, res, next) => {
    try {
      const data = await subjectService.create(req.client._id, req.body);
      return res.send({ ok: true, data, msg: "subject.created" });
    } catch (error) {
      next(error);
    }
  },

  list: async (req, res, next) => {
    try {
      const { page, search, center } = req.query;
      const { data, meta } = await subjectService.list(req.client._id, { page, search, center });
      return res.send({ ok: true, data, meta });
    } catch (error) {
      next(error);
    }
  },

  getOne: async (req, res, next) => {
    try {
      const data = await subjectService.getOne(req.client._id, req.params.id);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  exportList: async (req, res, next) => {
    try {
      const { search, center } = req.query;
      const rows = await subjectService.exportList(req.client._id, { search, center });
      await sendExcel(res, "fanlar", [
        {
          sheetName: "Fanlar",
          color: THEME.subject,
          title: "Fanlar ro'yxati",
          subtitle: `Jami: ${rows.length} ta`,
          columns: [
            { header: "Fan nomi", width: 24, value: (r) => r.name },
            { header: "Standart narx (so'm)", width: 20, align: "right", numFmt: "#,##0", value: (r) => r.price },
            { header: "Davomiyligi (oy)", width: 16, align: "right", value: (r) => r.durationMonths },
            { header: "Filial", width: 20, value: (r) => r.centerName },
            { header: "Sana", width: 18, value: (r) => r.date },
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
      const data = await subjectService.update(req.client._id, req.params.id, req.body);
      return res.send({ ok: true, data, msg: "subject.updated" });
    } catch (error) {
      next(error);
    }
  },

  remove: async (req, res, next) => {
    try {
      await subjectService.remove(req.client._id, req.params.id, buildActor(req));
      return res.send({ ok: true, msg: "archive.archived" });
    } catch (error) {
      next(error);
    }
  },
};
