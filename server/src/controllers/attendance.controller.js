const attendanceService = require("../services/attendance.service");
const { MONTH_RE } = require("../utils/gradeScore.util");
const { teachingScopeField } = require("../middlewares/authenticator.middleware");
const { buildActor } = require("../utils/audit.util");

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
      const reset = req.query.reset === "true";
      // QR'ni yangilash bosilgan kartalarni yaroqsiz qiladi — faqat Owner yoki
      // `attendance:update` ruxsatli resepshin; o'qituvchi rollari uchun yopiq.
      if (reset && req.staff) {
        const perms = req.staff.permissions || [];
        const teaching = ["teacher", "assistant"].includes(req.staff.role);
        if (teaching || !(perms.includes("all") || perms.includes("attendance:update"))) {
          throw new Error("auth.forbidden");
        }
      }
      const data = await attendanceService.getQrToken(
        req.client._id,
        req.params.studentId,
        reset,
        req.centerScope || null,
      );
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  // QR kartani Telegramga yuborish — multipart `card` (PNG ≤ 2 MB).
  sendQrCard: async (req, res, next) => {
    try {
      const data = await attendanceService.sendQrCard(
        req.client._id,
        req.params.studentId,
        req.files?.card,
        req.centerScope || null,
        buildActor(req),
      );
      return res.send({ ok: true, data, msg: "attendance.qrCardSent" });
    } catch (error) {
      next(error);
    }
  },

  getGroupQrCards: async (req, res, next) => {
    try {
      const data = await attendanceService.getGroupQrCards(req.client._id, req.params.groupId, req.centerScope || null);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  scanQr: async (req, res, next) => {
    try {
      // Hodim bo'lsa filiali uzatiladi — faqat o'z filialining
      // o'quvchisini belgilay oladi (Owner uchun null).
      const field = teachingScopeField(req);
      const data = await attendanceService.scanQr(
        req.client._id,
        req.body,
        req.centerScope || null,
        field ? { field, staffId: req.staff._id } : null,
      );
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

  getStudentsSummary: async (req, res, next) => {
    try {
      // `?month=YYYY-MM` ixtiyoriy (default — joriy oy). server/ da zod
      // ulanmagan (center.service izohi) — qo'lda tekshiruv.
      const { month } = req.query;
      if (month !== undefined && !MONTH_RE.test(String(month))) throw new Error("validation.month");
      const data = await attendanceService.getStudentsSummary(req.client._id, req.params.groupId, month);
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
