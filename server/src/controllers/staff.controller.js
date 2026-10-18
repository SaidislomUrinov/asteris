const staffService = require("../services/staff.service");
const authService = require("../services/auth.service");
const clientService = require("../services/client.service");
const { sendExcel, THEME } = require("../utils/excel.util");
const { buildActor } = require("../utils/audit.util");

const ROLE_LABELS = { manager: "Menejer", reception: "Resepshin", teacher: "O'qituvchi" };

module.exports = {
  create: async (req, res, next) => {
    try {
      const data = await staffService.create(req.client._id, req.body, buildActor(req));
      return res.send({ ok: true, data, msg: "staff.created" });
    } catch (error) {
      next(error);
    }
  },

  list: async (req, res, next) => {
    try {
      const { page, search, center, role } = req.query;
      const { data, meta } = await staffService.list(req.client._id, { page, search, center, role });
      return res.send({ ok: true, data, meta });
    } catch (error) {
      next(error);
    }
  },

  lookup: async (req, res, next) => {
    try {
      const { center, role } = req.query;
      const data = await staffService.lookup(req.client._id, { center, role });
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  getOne: async (req, res, next) => {
    try {
      const data = await staffService.getOne(req.client._id, req.params.id, req.centerScope || null);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  exportList: async (req, res, next) => {
    try {
      const { search, center, role } = req.query;
      const rows = await staffService.exportList(req.client._id, { search, center, role });
      await sendExcel(res, "xodimlar", [
        {
          sheetName: "Xodimlar",
          color: THEME.staff,
          title: "Xodimlar ro'yxati",
          subtitle: `Jami: ${rows.length} ta`,
          columns: [
            { header: "F.I.Sh.", width: 24, value: (r) => r.name },
            { header: "Telefon", width: 18, value: (r) => r.phone },
            { header: "Filial", width: 20, value: (r) => r.centerName },
            { header: "Lavozim", width: 16, value: (r) => ROLE_LABELS[r.role] || r.role },
            { header: "Holat", width: 14, value: (r) => (r.blocked ? "Bloklangan" : "Faol") },
          ],
          rows,
        },
      ]);
    } catch (error) {
      next(error);
    }
  },

  update: async (req, res, next) => {
    try {
      const data = await staffService.update(req.client._id, req.params.id, req.body, buildActor(req), req.centerScope || null);
      return res.send({ ok: true, data, msg: "staff.updated" });
    } catch (error) {
      next(error);
    }
  },

  remove: async (req, res, next) => {
    try {
      await staffService.remove(req.client._id, req.params.id, buildActor(req));
      return res.send({ ok: true, msg: "archive.archived" });
    } catch (error) {
      next(error);
    }
  },

  block: async (req, res, next) => {
    try {
      const data = await staffService.setBlocked(req.client._id, req.params.id, true, buildActor(req));
      return res.send({ ok: true, data, msg: "staff.blockedSuccess" });
    } catch (error) {
      next(error);
    }
  },

  unblock: async (req, res, next) => {
    try {
      const data = await staffService.setBlocked(req.client._id, req.params.id, false, buildActor(req));
      return res.send({ ok: true, data, msg: "staff.unblocked" });
    } catch (error) {
      next(error);
    }
  },

  signIn: async (req, res, next) => {
    try {
      const { data, access } = await authService.staffSession(req.body, req.headers["x-center-id"]);
      return res.send({ ok: true, data, access, msg: "auth.success" });
    } catch (error) {
      next(error);
    }
  },

  verify: async (req, res, next) => {
    try {
      // Tarif flaglari ham qo'shiladi — hodim panelida premium bo'limlar
      // (masalan "QR davomat") shu ro'yxatga qarab ko'rsatiladi
      // (docs/API_CONTRACT_qr_attendance_staff.md).
      const [{ active }, tariffFeatures, tariffName, context] = await Promise.all([
        clientService.getSubscriptionStatus(req.staff.client),
        clientService.getTariffFeatures(req.staff.client),
        clientService.getTariffName(req.staff.client),
        // Faol filialni middleware allaqachon hisoblagan (`req.staff.center`).
        clientService.sessionContext(req.staff.client, {
          centerIds: req.staff.centers,
          excludeBlocked: true,
          wanted: req.staff.center,
        }),
      ]);
      return res.send({
        ok: true,
        data: { ...req.staff, subscriptionActive: active, tariffFeatures, tariffName, ...context },
      });
    } catch (error) {
      next(error);
    }
  },

  signOutSession: async (req, res, next) => {
    try {
      await staffService.signOutSession(req.staff, req.authChannel);
      return res.send({ ok: true, msg: "auth.signOut" });
    } catch (error) {
      next(error);
    }
  },

  updateOwnProfile: async (req, res, next) => {
    try {
      const data = await staffService.updateOwnProfile(req.staff._id, req.body);
      return res.send({ ok: true, data, msg: "staff.profileUpdated" });
    } catch (error) {
      next(error);
    }
  },

  setOwnPhone: async (req, res, next) => {
    try {
      const data = await staffService.setOwnPhone(req.staff._id, req.body, buildActor(req));
      return res.send({ ok: true, data, msg: "staff.phoneSaved" });
    } catch (error) {
      next(error);
    }
  },

  markIntroSeen: async (req, res, next) => {
    try {
      await staffService.markIntroSeen(req.staff._id);
      return res.send({ ok: true, msg: "auth.introSeen" });
    } catch (error) {
      next(error);
    }
  },
};
