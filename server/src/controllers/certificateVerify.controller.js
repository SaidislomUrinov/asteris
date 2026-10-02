const certificateService = require("../services/certificate.service");

module.exports = {
  verify: async (req, res, next) => {
    try {
      const data = await certificateService.verify(req.params.code);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },
};
