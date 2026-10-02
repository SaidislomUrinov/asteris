const studentLeadService = require("../services/studentLead.service");
const { buildActor } = require("../utils/audit.util");

module.exports = {
  list: async (req, res, next) => {
    try {
      const { page, search, center, subject, status, days, time, level, source } = req.query;
      const { data, meta } = await studentLeadService.list(req.client._id, {
        page,
        search,
        center,
        subject,
        status,
        days,
        time,
        level,
        source,
      });
      return res.send({ ok: true, data, meta });
    } catch (error) {
      next(error);
    }
  },

  summary: async (req, res, next) => {
    try {
      const data = await studentLeadService.summary(req.client._id, { center: req.query.center });
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  monthStats: async (req, res, next) => {
    try {
      const { month, center } = req.query;
      const data = await studentLeadService.monthStats(req.client._id, { month, center });
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  create: async (req, res, next) => {
    try {
      const data = await studentLeadService.create(req.client._id, req.body, buildActor(req));
      return res.send({ ok: true, data, msg: "lead.created" });
    } catch (error) {
      next(error);
    }
  },

  update: async (req, res, next) => {
    try {
      const data = await studentLeadService.update(req.client._id, req.params.id, req.body, buildActor(req));
      return res.send({ ok: true, data, msg: "lead.updated" });
    } catch (error) {
      next(error);
    }
  },

  remove: async (req, res, next) => {
    try {
      const data = await studentLeadService.remove(req.client._id, req.params.id, buildActor(req));
      return res.send({ ok: true, data, msg: "lead.deleted" });
    } catch (error) {
      next(error);
    }
  },

  enroll: async (req, res, next) => {
    try {
      const data = await studentLeadService.enroll(req.client._id, req.body, {
        staff: req.staff || null,
        centerScope: req.centerScope || null,
        actor: buildActor(req),
      });
      return res.send({ ok: true, data, msg: "lead.enrolled" });
    } catch (error) {
      next(error);
    }
  },
};
