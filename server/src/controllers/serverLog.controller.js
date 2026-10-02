const serverLogService = require("../services/serverLog.service");

module.exports = {
  files: async (req, res, next) => {
    try {
      const data = await serverLogService.files();
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  tail: async (req, res, next) => {
    try {
      const { file, lines, search } = req.query;
      const data = await serverLogService.tail({ file, lines, search });
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  download: async (req, res, next) => {
    try {
      const { filePath, name } = await serverLogService.downloadPath(req.query.file);
      return res.download(filePath, name);
    } catch (error) {
      next(error);
    }
  },
};
