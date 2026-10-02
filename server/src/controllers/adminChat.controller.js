const chatService = require("../services/chat.service");

module.exports = {
  listConversations: async (req, res, next) => {
    try {
      const data = await chatService.listConversations(req.query);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  getMessages: async (req, res, next) => {
    try {
      const data = await chatService.getConversationMessages(req.params.id, req.query);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  sendText: async (req, res, next) => {
    try {
      const data = await chatService.sendAdminText(req.params.id, req.admin._id, req.body);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  sendImage: async (req, res, next) => {
    try {
      const data = await chatService.sendAdminImage(req.params.id, req.admin._id, req.files?.image);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  sendGreeting: async (req, res, next) => {
    try {
      const data = await chatService.sendGreeting(req.params.id, req.admin._id, req.body?.lang);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  markRead: async (req, res, next) => {
    try {
      const data = await chatService.markReadByAdmin(req.params.id);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },
};
