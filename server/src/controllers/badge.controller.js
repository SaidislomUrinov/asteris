const { teachingScopeField } = require("../middlewares/authenticator.middleware");
const badgeService = require("../services/badge.service");
const { MONTH_RE } = require("../utils/gradeScore.util");

// Yutuq nishonlari (API_CONTRACT_badges_monthly_rank.md §C). Staff bo'lsa
// `req.centerScope` — o'z filiali (tenantAuth qo'yadi), Owner uchun null.
module.exports = {
  getGroup: async (req, res, next) => {
    try {
      const { month } = req.query;
      if (month !== undefined && !MONTH_RE.test(String(month))) throw new Error("validation.month");
      const data = await badgeService.getGroup(
        req.client._id,
        req.params.groupId,
        month,
        req.centerScope || null,
      );
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  getStudent: async (req, res, next) => {
    try {
      const field = teachingScopeField(req);
      const data = await badgeService.getStudent(req.client._id, req.params.studentId, req.centerScope || null, {
        teaching: field ? { field, staffId: req.staff._id } : null,
      });
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },
};
