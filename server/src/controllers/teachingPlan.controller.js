const { buildActor } = require("../utils/audit.util");
const teachingPlanService = require("../services/teachingPlan.service");

// "Dars rejalarim" — API_CONTRACT_teaching_plans.md §4.1. Egalik va rol
// tekshiruvi servisda (`req.staff` yo'q yoki teacher/assistant emas → 403).
module.exports = {
  subjects: async (req, res, next) => {
    try {
      const data = await teachingPlanService.subjects(req.client._id, req.staff || null);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  list: async (req, res, next) => {
    try {
      const data = await teachingPlanService.list(req.client._id, req.staff || null, {
        subject: req.query?.subject,
      });
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  getOne: async (req, res, next) => {
    try {
      const data = await teachingPlanService.getOne(req.client._id, req.staff || null, req.params.id);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  create: async (req, res, next) => {
    try {
      const data = await teachingPlanService.create(req.client._id, req.staff || null, req.body);
      return res.status(201).send({ ok: true, data, msg: "teachingPlan.created" });
    } catch (error) {
      next(error);
    }
  },

  update: async (req, res, next) => {
    try {
      const data = await teachingPlanService.update(
        req.client._id,
        req.staff || null,
        req.params.id,
        req.body,
      );
      return res.send({ ok: true, data, msg: "teachingPlan.saved" });
    } catch (error) {
      next(error);
    }
  },

  duplicate: async (req, res, next) => {
    try {
      const data = await teachingPlanService.duplicate(req.client._id, req.staff || null, req.params.id);
      return res.status(201).send({ ok: true, data, msg: "teachingPlan.duplicated" });
    } catch (error) {
      next(error);
    }
  },

  remove: async (req, res, next) => {
    try {
      const data = await teachingPlanService.remove(
        req.client._id,
        req.staff || null,
        req.params.id,
        buildActor(req),
      );
      return res.send({ ok: true, data, msg: "teachingPlan.deleted" });
    } catch (error) {
      next(error);
    }
  },
};
