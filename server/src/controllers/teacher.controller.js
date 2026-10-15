const teacherService = require("../services/teacher.service");

module.exports = {
  dashboard: async (req, res, next) => {
    try {
      // Faqat o'z ma'lumoti: staff bo'lsa o'zining id'si, Owner ko'rmoqchi
      // bo'lsa `?teacherId=` orqali (masalan hodim kartochkasida).
      const staffId = req.staff?._id || req.query.teacherId;
      if (!staffId) throw new Error("staff.notFound");

      const data = await teacherService.dashboard(req.client._id, staffId, {
        month: req.query.month,
        scopeField: req.staff?.role === "assistant" ? "assistant" : "teacher",
        centerId: req.centerScope || null,
      });
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  currentLesson: async (req, res, next) => {
    try {
      const staffId = req.staff?._id;
      if (!staffId) throw new Error("staff.notFound");

      const scopeField = req.staff?.role === "assistant" ? "assistant" : "teacher";
      const data = await teacherService.currentLesson(req.client._id, staffId, scopeField, req.centerScope || null);
      return res.send({ ok: true, data, msg: data ? null : "lesson.none" });
    } catch (error) {
      next(error);
    }
  },
};
