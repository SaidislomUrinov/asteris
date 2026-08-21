const Notification = require("../models/Notification");
const emit = require("../utils/emitter.util");

const DTO = (n) => ({
  _id: String(n._id),
  type: n.type,
  title: n.title,
  body: n.body || "",
  data: n.data || {},
  read: !!n.read,
  createdAt: n.createdAt,
});

const PAGE_SIZE = 30;

// Yagona yaratish nuqtasi — barcha modullar shu orqali bildirishnoma
// yuboradi. `dedupKey` berilsa bir xil xabar ikki marta yozilmaydi
// (unique sparse index; masalan bitta darsning eslatmasi).
const create = async ({ clientId, centerId = null, recipient, type, title, body = "", data = {}, dedupKey = null }) => {
  try {
    const doc = await Notification.create({
      client: clientId,
      center: centerId,
      recipient,
      type,
      title,
      body,
      data,
      dedupKey,
    });

    // Faqat O'SHA foydalanuvchining xonasiga — bildirishnoma shaxsiy.
    emit(`user:${recipient.id}`, "notification:new", DTO(doc));
    return DTO(doc);
  } catch (error) {
    // Dedup (E11000) — bu xato emas, xabar allaqachon yuborilgan.
    if (error?.code === 11000) return null;
    throw error;
  }
};

module.exports = {
  create,

  list: async (userId, { page = 1 } = {}) => {
    const pageNum = Math.max(1, Number(page) || 1);
    const [data, total, unread] = await Promise.all([
      Notification.find({ "recipient.id": userId })
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE),
      Notification.countDocuments({ "recipient.id": userId }),
      Notification.countDocuments({ "recipient.id": userId, read: false }),
    ]);

    return {
      data: data.map(DTO),
      unread,
      meta: {
        page: pageNum,
        limit: PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / PAGE_SIZE) || 1,
      },
    };
  },

  unreadCount: async (userId) =>
    await Notification.countDocuments({ "recipient.id": userId, read: false }),

  markRead: async (userId, id) => {
    const doc = await Notification.findOneAndUpdate(
      { _id: id, "recipient.id": userId },
      { $set: { read: true, readAt: Math.floor(Date.now() / 1000) } },
      { new: true },
    );
    if (!doc) throw new Error("notification.notFound");
    return DTO(doc);
  },

  markAllRead: async (userId) => {
    await Notification.updateMany(
      { "recipient.id": userId, read: false },
      { $set: { read: true, readAt: Math.floor(Date.now() / 1000) } },
    );
    return { ok: true };
  },
};
