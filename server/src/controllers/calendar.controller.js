const calendarService = require("../services/calendar.service");
const { buildActor } = require("../utils/audit.util");

// server/ da zod paketi ulanmagan (package.json'da yo'q) — repo konvensiyasiga
// mos, boshqa controllerlar kabi qo'lda tekshiruv qilinadi (servis xatoni
// tashlaydi, controller faqat yuzaki shakl tekshiruvini bajaradi).
const validateMarkBody = (body) => {
  const dates = Array.isArray(body?.dates) ? body.dates : [];
  if (!dates.length || dates.some((d) => typeof d !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d))) {
    throw new Error("calendar.invalidDate");
  }
  if (body?.note !== undefined && typeof body.note !== "string") {
    throw new Error("calendar.invalidNote");
  }
  return { dates, note: body?.note };
};

module.exports = {
  list: async (req, res, next) => {
    try {
      const data = await calendarService.listForMonth(req.client._id, req.params.centerId, req.params.month);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  mark: async (req, res, next) => {
    try {
      const body = validateMarkBody(req.body);
      const createdBy = req.staff
        ? { kind: "staff", id: req.staff._id }
        : { kind: "owner", id: req.client._id };
      const data = await calendarService.mark(req.client._id, req.params.centerId, createdBy, body);
      return res.send({ ok: true, data, msg: "calendar.marked" });
    } catch (error) {
      next(error);
    }
  },

  unmark: async (req, res, next) => {
    try {
      const data = await calendarService.unmark(req.client._id, req.params.centerId, req.params.date, buildActor(req));
      return res.send({ ok: true, data, msg: "calendar.unmarked" });
    } catch (error) {
      next(error);
    }
  },
};
