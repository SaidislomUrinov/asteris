const tutorialVideoService = require("../services/tutorialVideo.service");

module.exports = {
  list: async (req, res, next) => {
    try {
      const data = await tutorialVideoService.list();
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  upsert: async (req, res, next) => {
    try {
      const data = await tutorialVideoService.upsert(
        req.params.sectionKey,
        { youtubeUrl: req.body?.youtubeUrl, title: req.body?.title },
      );
      return res.send({ ok: true, data, msg: "tutorialVideo.saved" });
    } catch (error) {
      next(error);
    }
  },

  reorder: async (req, res, next) => {
    try {
      const data = await tutorialVideoService.reorder(req.body?.keys);
      return res.send({ ok: true, data, msg: "tutorialVideo.reordered" });
    } catch (error) {
      next(error);
    }
  },

  remove: async (req, res, next) => {
    try {
      await tutorialVideoService.remove(req.params.sectionKey);
      return res.send({ ok: true, msg: "tutorialVideo.deleted" });
    } catch (error) {
      next(error);
    }
  },
};
