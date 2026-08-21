const notificationService = require("../services/notification.service");

// Bildirishnoma SHAXSIY — kim so'ragan bo'lsa o'shaniki. Client Owner uchun
// `req.client._id`, Staff uchun `req.staff._id` (mustaqil auth zanjirlari).
const userIdOf = (req) => String(req.staff?._id || req.client._id);

module.exports = {
  list: async (req, res, next) => {
    try {
      const { data, unread, meta } = await notificationService.list(userIdOf(req), {
        page: req.query.page,
      });
      return res.send({ ok: true, data, unread, meta });
    } catch (error) {
      next(error);
    }
  },

  unreadCount: async (req, res, next) => {
    try {
      const unread = await notificationService.unreadCount(userIdOf(req));
      return res.send({ ok: true, data: { unread } });
    } catch (error) {
      next(error);
    }
  },

  markRead: async (req, res, next) => {
    try {
      const data = await notificationService.markRead(userIdOf(req), req.params.id);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  markAllRead: async (req, res, next) => {
    try {
      const data = await notificationService.markAllRead(userIdOf(req));
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },
};
