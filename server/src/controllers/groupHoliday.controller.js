const groupHolidayService = require("../services/groupHoliday.service");

module.exports = {
  list: async (req, res, next) => {
    try {
      const data = await groupHolidayService.listForMonth(req.client._id, req.params.groupId, req.query.month);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  mark: async (req, res, next) => {
    try {
      const data = await groupHolidayService.mark(req.client._id, req.params.groupId, req.body);
      return res.send({ ok: true, data, msg: "group.holidayMarked" });
    } catch (error) {
      next(error);
    }
  },

  unmark: async (req, res, next) => {
    try {
      const data = await groupHolidayService.unmark(req.client._id, req.params.groupId, req.params.date);
      return res.send({ ok: true, data, msg: "group.holidayUnmarked" });
    } catch (error) {
      next(error);
    }
  },
};
