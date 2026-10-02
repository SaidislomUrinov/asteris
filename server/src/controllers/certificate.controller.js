const certificateService = require("../services/certificate.service");
const { buildActor } = require("../utils/audit.util");

module.exports = {
  issueForStudent: async (req, res, next) => {
    try {
      const data = await certificateService.issueForStudent(
        req.client._id,
        req.params.studentId,
        req.body,
        buildActor(req),
      );
      return res.send({ ok: true, data, msg: "certificate.issued" });
    } catch (error) {
      next(error);
    }
  },

  issueForGroup: async (req, res, next) => {
    try {
      const data = await certificateService.issueForGroup(
        req.client._id,
        req.params.groupId,
        req.body,
        buildActor(req),
      );
      return res.send({ ok: true, data, msg: "certificate.issuedBulk" });
    } catch (error) {
      next(error);
    }
  },

  listForStudent: async (req, res, next) => {
    try {
      const data = await certificateService.listForStudent(req.client._id, req.params.studentId);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },
};
