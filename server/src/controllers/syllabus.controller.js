const syllabusService = require("../services/syllabus.service");

// Guruhga biriktirilish orqali cheklanadigan rollar uchun qamrov —
// `teacherScope` middleware qo'ygan qiymatlardan yasaladi.
const scopeOf = (req) =>
  req.teacherScope ? { id: req.teacherScope, field: req.groupScopeField } : null;

module.exports = {
  get: async (req, res, next) => {
    try {
      const data = await syllabusService.get(req.client._id, req.params.groupId, scopeOf(req));
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  save: async (req, res, next) => {
    try {
      const data = await syllabusService.save(
        req.client._id,
        req.params.groupId,
        req.body,
        req.staff || null,
      );
      return res.send({ ok: true, data, msg: "syllabus.saved" });
    } catch (error) {
      next(error);
    }
  },

  setOffset: async (req, res, next) => {
    try {
      const data = await syllabusService.setOffset(
        req.client._id,
        req.params.groupId,
        req.body,
        req.staff || null,
      );
      return res.send({ ok: true, data, msg: "syllabus.offsetUpdated" });
    } catch (error) {
      next(error);
    }
  },

  sources: async (req, res, next) => {
    try {
      const data = await syllabusService.sources(
        req.client._id,
        req.params.groupId,
        scopeOf(req),
        // Staff faqat o'z filiali guruhlaridan import qiladi.
        req.staff?.center || "",
      );
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  plans: async (req, res, next) => {
    try {
      const data = await syllabusService.plans(
        req.client._id,
        req.params.groupId,
        scopeOf(req),
        // Staff faqat o'z filiali o'qituvchilarining rejalarini ko'radi.
        req.staff?.center || "",
        req.staff || null,
      );
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  importFrom: async (req, res, next) => {
    try {
      const data = await syllabusService.importFrom(
        req.client._id,
        req.params.groupId,
        req.body,
        req.staff || null,
      );
      return res.send({ ok: true, data, msg: "syllabus.imported" });
    } catch (error) {
      next(error);
    }
  },
};
