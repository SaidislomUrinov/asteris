const quizService = require("../services/quiz.service");

module.exports = {
  // GET /parent-quiz/active
  active: async (req, res, next) => {
    try {
      const data = await quizService.parentActiveAttempts(req.parent);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  // GET /parent-quiz/history
  history: async (req, res, next) => {
    try {
      const data = await quizService.parentHistory(req.parent);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  // GET /parent-quiz/:entryId/:quizId/state
  state: async (req, res, next) => {
    try {
      const data = await quizService.parentState(req.parent, req.params.entryId, req.params.quizId);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  // POST /parent-quiz/:entryId/:quizId/start
  start: async (req, res, next) => {
    try {
      const data = await quizService.parentStart(req.parent, req.params.entryId, req.params.quizId);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  // PUT /parent-quiz/:entryId/:quizId/answer — body { questionId, optionId }
  answer: async (req, res, next) => {
    try {
      const data = await quizService.parentAnswer(req.parent, req.params.entryId, req.params.quizId, req.body);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  // POST /parent-quiz/:entryId/:quizId/finish
  finish: async (req, res, next) => {
    try {
      const data = await quizService.parentFinish(req.parent, req.params.entryId, req.params.quizId);
      return res.send({ ok: true, data, msg: "quiz.finished" });
    } catch (error) {
      next(error);
    }
  },

  // GET /parent-quiz/:entryId/:quizId/result
  result: async (req, res, next) => {
    try {
      const data = await quizService.parentResult(req.parent, req.params.entryId, req.params.quizId);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },
};
