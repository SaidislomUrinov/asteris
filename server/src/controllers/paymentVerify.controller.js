const paymentVerifyService = require("../services/paymentVerify.service");

module.exports = {
  verify: async (req, res, next) => {
    try {
      const data = await paymentVerifyService.verify(req.params.id);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },
};
