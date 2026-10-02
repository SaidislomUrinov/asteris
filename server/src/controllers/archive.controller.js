const archiveService = require("../services/archive.service");
const { buildActor } = require("../utils/audit.util");

// Ro'yxat endpointlari bir xil shaklda — takroriy try/catch yozmaslik uchun
// bitta fabrikadan hosil qilinadi.
const listHandler = (method, withCenter = true) => async (req, res, next) => {
  try {
    const { page, search, center } = req.query;
    const { data, meta } = await archiveService[method](req.client._id, {
      page,
      search,
      ...(withCenter ? { center } : {}),
    });
    return res.send({ ok: true, data, meta });
  } catch (error) {
    next(error);
  }
};

const restoreHandler = (method, argsOf) => async (req, res, next) => {
  try {
    await archiveService[method](req.client._id, ...argsOf(req), buildActor(req));
    return res.send({ ok: true, msg: "archive.restored" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  counts: async (req, res, next) => {
    try {
      const data = await archiveService.counts(req.client._id, {
        center: req.query.center,
        // Hodim arxivi — faqat Boshliq (`req.staff` yo'q = Owner).
        includeStaff: !req.staff,
      });
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  groups: listHandler("groups"),
  students: listHandler("students"),
  rooms: listHandler("rooms"),
  subjects: listHandler("subjects"),
  teachingPlans: listHandler("teachingPlans"),
  staff: listHandler("staff", false),

  // Vaqt band bo'lsa (arxivda turgan payt slot boshqasiga berilgan) `body`
  // orqali yangi xona/kun/vaqt yuboriladi (GroupScheduleDialog qayta
  // ishlatilib qayta yuboriladi) — bo'sh bo'lsa eski jadval bilan tekshiriladi.
  restoreGroup: restoreHandler("restoreGroup", (req) => [
    req.params.id,
    {
      roomId: req.body?.roomId,
      days: req.body?.days,
      startTime: req.body?.startTime,
      endTime: req.body?.endTime,
    },
  ]),
  restoreRoom: restoreHandler("restoreRoom", (req) => [req.params.id]),
  restoreSubject: restoreHandler("restoreSubject", (req) => [req.params.id]),
  restoreTeachingPlan: restoreHandler("restoreTeachingPlan", (req) => [req.params.id]),
  restoreStaff: restoreHandler("restoreStaff", (req) => [req.params.id]),
  restoreStudentEntry: restoreHandler("restoreStudentEntry", (req) => [
    req.params.studentId,
    req.params.entryId,
  ]),
};
