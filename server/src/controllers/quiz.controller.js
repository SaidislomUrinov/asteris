const quizService = require("../services/quiz.service");
const { buildActor } = require("../utils/audit.util");

// Tenant qamrovi: Staff — o'z filiali (`req.centerScope`), o'qituvchi/assistent
// — o'z guruhi (`teacherScope` middleware qo'ygan qiymatlar). Homework
// controlleridagi bilan bir xil naqsh.
const scopeOf = (req) => ({
  centerId: req.centerScope || null,
  teacher: req.teacherScope ? { id: req.teacherScope, field: req.groupScopeField } : null,
});

module.exports = {
  // GET /quiz/:groupId
  listByGroup: async (req, res, next) => {
    try {
      const data = await quizService.listByGroup(req.client._id, req.params.groupId, scopeOf(req));
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  // GET /quiz/:groupId/:quizId
  detail: async (req, res, next) => {
    try {
      const data = await quizService.detail(req.client._id, req.params.groupId, req.params.quizId, scopeOf(req));
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  // POST /quiz/:groupId/import — multipart `file` yoki JSON { questions }.
  importQuestions: async (req, res, next) => {
    try {
      const data = await quizService.importQuestions(
        req.client._id,
        req.params.groupId,
        req.body,
        req.files?.file,
        scopeOf(req),
      );
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  // POST /quiz/:groupId
  create: async (req, res, next) => {
    try {
      const data = await quizService.create(req.client._id, req.params.groupId, req.body, buildActor(req), scopeOf(req));
      return res.send({ ok: true, data, msg: "quiz.created" });
    } catch (error) {
      next(error);
    }
  },

  // PUT /quiz/:groupId/:quizId
  update: async (req, res, next) => {
    try {
      const data = await quizService.update(
        req.client._id,
        req.params.groupId,
        req.params.quizId,
        req.body,
        scopeOf(req),
      );
      return res.send({ ok: true, data, msg: "quiz.updated" });
    } catch (error) {
      next(error);
    }
  },

  // DELETE /quiz/:groupId/:quizId
  remove: async (req, res, next) => {
    try {
      await quizService.remove(req.client._id, req.params.groupId, req.params.quizId, scopeOf(req));
      return res.send({ ok: true, data: null, msg: "quiz.deleted" });
    } catch (error) {
      next(error);
    }
  },

  // PUT /quiz/:groupId/:quizId/attempts/:studentId/score — body { score }
  setScore: async (req, res, next) => {
    try {
      const data = await quizService.setScore(
        req.client._id,
        req.params.groupId,
        req.params.quizId,
        req.params.studentId,
        req.body?.score,
        scopeOf(req),
      );
      return res.send({ ok: true, data, msg: "quiz.scoreSaved" });
    } catch (error) {
      next(error);
    }
  },
};
