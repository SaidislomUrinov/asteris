const homeworkService = require("../services/homework.service");
const { buildActor } = require("../utils/audit.util");

// Tenant qamrovi: Staff — o'z filiali (`req.centerScope`), o'qituvchi/assistent
// — o'z guruhi (`teacherScope` middleware qo'ygan qiymatlar).
const scopeOf = (req) => ({
  centerId: req.centerScope || null,
  teacher: req.teacherScope ? { id: req.teacherScope, field: req.groupScopeField } : null,
});

module.exports = {
  // GET /homework/:groupId?month=YYYY-MM
  listByGroup: async (req, res, next) => {
    try {
      const data = await homeworkService.listByGroup(req.client._id, req.params.groupId, req.query.month, scopeOf(req));
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  // PUT /homework/:groupId/:date — body { text }; bo'sh matn o'chiradi.
  set: async (req, res, next) => {
    try {
      const { item, deleted } = await homeworkService.set(
        req.client._id,
        req.params.groupId,
        req.params.date,
        req.body,
        buildActor(req),
        scopeOf(req),
      );
      return res.send({ ok: true, data: item, msg: deleted ? "homework.deleted" : "homework.saved" });
    } catch (error) {
      next(error);
    }
  },
};
