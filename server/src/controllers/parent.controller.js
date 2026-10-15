// OTA-ONA (Telegram WebApp) — API_CONTRACT_parent.md §4. `/parent-auth` va
// `/parent/*` ikkalasi ham shu bitta controller/service zanjirida (CLAUDE.md:
// bir domen uchun bitta zanjir). Tenant tokenda emas — servis har so'rovda
// topilgan a'zolik bo'yicha tekshiradi (`resolveEntry`).
const parentService = require("../services/parent.service");

module.exports = {
  // POST /parent-auth/telegram
  authTelegram: async (req, res, next) => {
    try {
      const { initData } = req.body || {};
      const data = await parentService.authTelegram({ initData });
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  me: async (req, res, next) => {
    try {
      const data = await parentService.me(req.parent);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  children: async (req, res, next) => {
    try {
      const data = await parentService.children(req.parent);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  entryAttendance: async (req, res, next) => {
    try {
      const data = await parentService.entryAttendance(req.parent, req.params.entryId, req.query.month);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  entryGrades: async (req, res, next) => {
    try {
      const data = await parentService.entryGrades(req.parent, req.params.entryId, req.query.month);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  entryPayments: async (req, res, next) => {
    try {
      const data = await parentService.entryPayments(req.parent, req.params.entryId);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  // Guruhdagi o'rin (API_CONTRACT_student_role_homework.md §3.5).
  entryRank: async (req, res, next) => {
    try {
      const data = await parentService.entryRank(req.parent, req.params.entryId);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  // Yutuq nishonlari (API_CONTRACT_badges_monthly_rank.md §C).
  entryBadges: async (req, res, next) => {
    try {
      const data = await parentService.entryBadges(req.parent, req.params.entryId);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  // QR karta (API_CONTRACT_parent_qr_card.md §1.1).
  entryQrCard: async (req, res, next) => {
    try {
      const data = await parentService.entryQrCard(req.parent, req.params.entryId);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  // QR kartani o'z Telegram chatiga — multipart `card` (PNG ≤ 2 MB), §1.2.
  sendEntryQrCard: async (req, res, next) => {
    try {
      await parentService.sendEntryQrCard(req.parent, req.params.entryId, req.files?.card);
      return res.send({ ok: true, msg: "parent.qrCardSent" });
    } catch (error) {
      next(error);
    }
  },

  // Uyga vazifalar (§3.6).
  entryLessonPlan: async (req, res, next) => {
    try {
      const data = await parentService.entryLessonPlan(req.parent, req.params.entryId);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  entryHomework: async (req, res, next) => {
    try {
      const data = await parentService.entryHomework(req.parent, req.params.entryId, req.query.month);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  // PATCH /parent/role (§3.2)
  updateRole: async (req, res, next) => {
    try {
      const { role } = req.body || {};
      const data = await parentService.updateRole(req.parent, role);
      return res.send({ ok: true, data, msg: "parent.roleSaved" });
    } catch (error) {
      next(error);
    }
  },

  payments: async (req, res, next) => {
    try {
      const data = await parentService.allPayments(req.parent);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  notifications: async (req, res, next) => {
    try {
      const { page, type } = req.query;
      const { data, meta } = await parentService.notifications(req.parent, { page, type });
      return res.send({ ok: true, data, meta });
    } catch (error) {
      next(error);
    }
  },

  readAllNotifications: async (req, res, next) => {
    try {
      await parentService.readAllNotifications(req.parent);
      return res.send({ ok: true, msg: "notification.allRead" });
    } catch (error) {
      next(error);
    }
  },

  updateSettings: async (req, res, next) => {
    try {
      const { lang, mute } = req.body || {};
      const data = await parentService.updateSettings(req.parent, { lang, mute });
      return res.send({ ok: true, data, msg: "parent.settingsUpdated" });
    } catch (error) {
      next(error);
    }
  },

  // POST /parent/unlink — bot `/unlink` bilan bir xil (hujjat o'chiriladi).
  unlink: async (req, res, next) => {
    try {
      await parentService.unlink(req.parent.telegram.chatId);
      return res.send({ ok: true, msg: "parent.unlinked" });
    } catch (error) {
      next(error);
    }
  },

  // WECOIN (API_CONTRACT_wecoin.md §4).
  coins: async (req, res, next) => {
    try {
      const data = await parentService.coins(req.parent);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  coinShop: async (req, res, next) => {
    try {
      const data = await parentService.coinShop(req.parent, req.params.studentId, req.params.centerId);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  coinBuy: async (req, res, next) => {
    try {
      const { studentId, centerId, productId } = req.params;
      const data = await parentService.coinBuy(req.parent, studentId, centerId, productId);
      return res.send({ ok: true, data, msg: "shop.bought" });
    } catch (error) {
      next(error);
    }
  },

  coinLike: async (req, res, next) => {
    try {
      const { studentId, centerId, productId } = req.params;
      const data = await parentService.coinLike(req.parent, studentId, centerId, productId);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  coinHistory: async (req, res, next) => {
    try {
      const data = await parentService.coinHistory(req.parent, req.params.studentId, req.params.centerId);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },
};
