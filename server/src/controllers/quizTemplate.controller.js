const quizTemplateService = require("../services/quizTemplate.service");
const { buildActor } = require("../utils/audit.util");

// TEST SHABLONLARI — docs/API_CONTRACT_quiz_templates.md. Egalik va rol
// tekshiruvi servisda (`req.staff` yo'q yoki teacher/assistant emas → 403).
// `send` uchun scope quiz.controller.js'dagi `scopeOf` bilan AYNAN bir xil
// (quiz.service.js `create()`ning guruh egalik tekshiruvi shu scope'ga tayanadi).
const scopeOf = (req) => ({
  centerId: req.centerScope || null,
  teacher: req.teacherScope ? { id: req.teacherScope, field: req.groupScopeField } : null,
});

module.exports = {
  list: async (req, res, next) => {
    try {
      const data = await quizTemplateService.list(req.client._id, req.staff || null, {
        subject: req.query?.subject,
      });
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  getOne: async (req, res, next) => {
    try {
      const data = await quizTemplateService.getOne(req.client._id, req.staff || null, req.params.id);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  create: async (req, res, next) => {
    try {
      const data = await quizTemplateService.create(req.client._id, req.staff || null, req.body);
      return res.status(201).send({ ok: true, data, msg: "quizTemplate.created" });
    } catch (error) {
      next(error);
    }
  },

  update: async (req, res, next) => {
    try {
      const data = await quizTemplateService.update(
        req.client._id,
        req.staff || null,
        req.params.id,
        req.body,
      );
      return res.send({ ok: true, data, msg: "quizTemplate.saved" });
    } catch (error) {
      next(error);
    }
  },

  remove: async (req, res, next) => {
    try {
      const data = await quizTemplateService.remove(
        req.client._id,
        req.staff || null,
        req.params.id,
        buildActor(req),
      );
      return res.send({ ok: true, data, msg: "quizTemplate.deleted" });
    } catch (error) {
      next(error);
    }
  },

  send: async (req, res, next) => {
    try {
      const data = await quizTemplateService.send(
        req.client._id,
        req.staff || null,
        req.params.id,
        req.body,
        buildActor(req),
        scopeOf(req),
      );
      return res.send({ ok: true, data, msg: "quiz.created" });
    } catch (error) {
      next(error);
    }
  },
};
