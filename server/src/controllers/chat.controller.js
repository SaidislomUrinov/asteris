const chatService = require("../services/chat.service");

module.exports = {
  getConversation: async (req, res, next) => {
    try {
      const data = await chatService.getMyConversation(req);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  getMessages: async (req, res, next) => {
    try {
      const data = await chatService.getMyMessages(req, req.query);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  sendText: async (req, res, next) => {
    try {
      const data = await chatService.sendMyText(req, req.body?.text);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  sendImage: async (req, res, next) => {
    try {
      const data = await chatService.sendMyImage(req, req.files?.image);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  markRead: async (req, res, next) => {
    try {
      const data = await chatService.markReadByClient(req);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },
};
