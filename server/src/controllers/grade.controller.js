const gradeService = require("../services/grade.service");
const { buildActor } = require("../utils/audit.util");

// Guruhga biriktirilish orqali cheklanadigan rollar uchun qamrov —
// `teacherScope` middleware qo'ygan qiymatlardan yasaladi.
const scopeOf = (req) =>
  req.teacherScope ? { id: req.teacherScope, field: req.groupScopeField } : null;

module.exports = {
  listByGroup: async (req, res, next) => {
    try {
      const data = await gradeService.listByGroup(
        req.client._id,
        req.params.groupId,
        req.query.month,
        scopeOf(req),
      );
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  set: async (req, res, next) => {
    try {
      const data = await gradeService.set(
        req.client._id,
        req.params.groupId,
        req.body,
        req.staff || null,
      );
      return res.send({ ok: true, data, msg: "grade.saved" });
    } catch (error) {
      next(error);
    }
  },

  remove: async (req, res, next) => {
    try {
      const data = await gradeService.remove(
        req.client._id,
        req.params.groupId,
        req.params.gradeId,
        req.staff || null,
        buildActor(req),
      );
      return res.send({ ok: true, data, msg: "grade.removed" });
    } catch (error) {
      next(error);
    }
  },

  studentSummary: async (req, res, next) => {
    try {
      const data = await gradeService.studentSummary(req.client._id, req.params.studentId);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  listByStudent: async (req, res, next) => {
    try {
      const data = await gradeService.listByStudent(
        req.client._id,
        req.params.groupId,
        req.params.studentId,
        scopeOf(req),
      );
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },
};
