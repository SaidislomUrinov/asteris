const attendanceService = require("../services/attendance.service");

module.exports = {
  getSettings: async (req, res, next) => {
    try {
      const data = await attendanceService.getSettings(req.client._id, req.params.centerId);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  updateSettings: async (req, res, next) => {
    try {
      const data = await attendanceService.updateSettings(req.client._id, req.params.centerId, req.body);
      return res.send({ ok: true, data, msg: "attendance.settingsUpdated" });
    } catch (error) {
      next(error);
    }
  },

  getToday: async (req, res, next) => {
    try {
      const data = await attendanceService.getToday(req.client._id, req.params.groupId);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  mark: async (req, res, next) => {
    try {
      const data = await attendanceService.mark(
        req.client._id,
        req.params.groupId,
        req.body,
        req.staff || null,
      );
      return res.send({ ok: true, data, msg: "attendance.marked" });
    } catch (error) {
      next(error);
    }
  },

  getMonth: async (req, res, next) => {
    try {
      const data = await attendanceService.getMonth(
        req.client._id,
        req.params.groupId,
        req.query.month,
      );
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  getQrToken: async (req, res, next) => {
    try {
      const data = await attendanceService.getQrToken(
        req.client._id,
        req.params.studentId,
        req.query.reset === "true",
        req.staff?.center || null,
      );
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  scanQr: async (req, res, next) => {
    try {
      // Hodim bo'lsa filiali uzatiladi — faqat o'z filialining
      // o'quvchisini belgilay oladi (Owner uchun null).
      const data = await attendanceService.scanQr(req.client._id, req.body, req.staff?.center || null);
      const msg = data.duplicate ? "attendance.alreadyMarked" : "attendance.marked";
      return res.send({ ok: true, data, msg: data.needsGroup ? undefined : msg });
    } catch (error) {
      next(error);
    }
  },

  getStats: async (req, res, next) => {
    try {
      const data = await attendanceService.getStats(req.client._id, req.params.groupId, req.query.month);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  getStudentHistory: async (req, res, next) => {
    try {
      const data = await attendanceService.getStudentHistory(
        req.client._id,
        req.params.groupId,
        req.params.studentId,
      );
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },
};
