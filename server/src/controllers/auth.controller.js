const authService = require("../services/auth.service");

module.exports = {
  // Yagona kirish — API_CONTRACT_staff_phone.md §2.
  signIn: async (req, res, next) => {
    try {
      const { data, access, authType } = await authService.signIn(req.body, req.headers["x-center-id"]);
      return res.send({ ok: true, data, access, authType, msg: "auth.success" });
    } catch (error) {
      next(error);
    }
  },
};
