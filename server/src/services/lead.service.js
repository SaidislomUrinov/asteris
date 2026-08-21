const Lead = require("../models/Lead");
const Client = require("../models/Client");
const { getHash } = require("../utils/hash.util");
const { formatDate } = require("../utils/date.util");
const { getAdminIo, getLeadViewer } = require("../configs/socket.config");

const emitLead = (event, lead) => {
  try {
    getAdminIo().emit(event, lead);
  } catch {
    // socket hali initIo bo'lmagan bo'lishi mumkin (masalan skript orqali seed)
  }
};

// Leadni hozir boshqa admin ochib turgan bo'lsa, tahrirlashga yo'l qo'ymaydi
const assertNotLockedByOther = (id, admin) => {
  const viewer = getLeadViewer(id);
  if (!viewer) return;
  if (String(viewer.adminId) === String(admin._id)) return;

  const err = new Error("lead.locked");
  err.lockedBy = viewer.name;
  throw err;
};

const PAGE_SIZE = 50;

const historyDTO = (h) => ({
  from: h.from,
  to: h.to,
  comment: h.comment,
  changedBy: h.changedBy?._id
    ? {
        _id: h.changedBy._id,
        name: h.changedBy.name,
        username: h.changedBy.username,
      }
    : h.changedBy,
  changedAt: h.changedAt,
  date: formatDate(h.changedAt),
});

const DTO = (data) => ({
  _id: data?._id,
  name: data?.name,
  phone: data?.phone,
  comment: data?.comment,
  platform: data?.platform,
  platformNote: data?.platformNote,
  status: data?.status,
  client: data?.client,
  statusHistory: (data?.statusHistory || []).map(historyDTO),
  date: data?.date,
  lastUpdate: data?.lastUpdate,
});

module.exports = {
  DTO,

  create: async (body) => {
    const { name, phone, comment, platform, platformNote } = body;

    if (!name || !phone || !platform) throw new Error("lead.fillTheRows");
    if (!Lead.PLATFORMS.includes(platform)) throw new Error("lead.invalidPlatform");

    const lead = await Lead.create({
      name: name.trim(),
      phone: phone.trim(),
      comment,
      platform,
      platformNote,
    });

    const dto = DTO(lead);
    emitLead("lead:created", dto);

    // Telegram ogohlantirishi — fire-and-forget, lead yaratilishini
    // hech qachon to'xtatmaydi (bot o'chiq bo'lsa jimgina o'tkaziladi).
    require("../bot/alert")
      .sendAlert(
        "newLead",
        {
          title: "Yangi lead",
          body: dto.name,
          meta: {
            Telefon: dto.phone,
            Platforma: dto.platform,
            Izoh: dto.comment || "",
          },
        },
        { throttle: false },
      )
      .catch(() => {});

    return dto;
  },

  list: async ({ page = 1, search = "", status = "" }) => {
    const trimmedSearch = search?.trim();

    if (trimmedSearch) {
      const regex = new RegExp(trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const data = await Lead.find({
        $or: [{ name: regex }, { phone: regex }],
      })
        .sort({ createdAt: -1 })
        .populate("statusHistory.changedBy", "name username");

      return {
        data: data.map(DTO),
        meta: { page: 1, limit: data.length, total: data.length, totalPages: 1 },
      };
    }

    const filter = {};
    if (status && Lead.STATUSES.includes(status)) filter.status = status;

    const pageNum = Math.max(1, Number(page) || 1);
    const skip = (pageNum - 1) * PAGE_SIZE;

    const [data, total] = await Promise.all([
      Lead.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(PAGE_SIZE)
        .populate("statusHistory.changedBy", "name username"),
      Lead.countDocuments(filter),
    ]);

    return {
      data: data.map(DTO),
      meta: {
        page: pageNum,
        limit: PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / PAGE_SIZE) || 1,
      },
    };
  },

  getOne: async (id) => {
    const lead = await Lead.findById(id).populate(
      "statusHistory.changedBy",
      "name username",
    );
    if (!lead) throw new Error("lead.notFound");
    return DTO(lead);
  },

  updateStatus: async (id, body, admin) => {
    assertNotLockedByOther(id, admin);

    const { to, comment } = body;
    if (!to || !Lead.STATUSES.includes(to)) throw new Error("lead.invalidStatus");

    const lead = await Lead.findById(id);
    if (!lead) throw new Error("lead.notFound");
    if (lead.status === to) throw new Error("lead.sameStatus");

    lead.statusHistory.push({
      from: lead.status,
      to,
      comment,
      changedBy: admin._id,
    });
    lead.status = to;

    await lead.save();
    await lead.populate("statusHistory.changedBy", "name username");

    const dto = DTO(lead);
    emitLead("lead:updated", dto);
    return dto;
  },

  createClient: async (id, body, admin) => {
    assertNotLockedByOther(id, admin);

    const { password } = body;
    if (!password) throw new Error("auth.fillTheRows");

    const lead = await Lead.findById(id);
    if (!lead) throw new Error("lead.notFound");
    if (lead.status !== "confirmed") throw new Error("lead.notConfirmed");
    if (lead.client) throw new Error("lead.alreadyClient");

    const client = await Client.create({
      name: lead.name,
      phone: lead.phone,
      password: await getHash(password.trim()),
      lead: lead._id,
    });

    lead.client = client._id;
    await lead.save();
    await lead.populate("statusHistory.changedBy", "name username");

    emitLead("lead:updated", DTO(lead));

    return {
      _id: client._id,
      clientId: client.clientId,
      name: client.name,
      phone: client.phone,
      blocked: client.blocked,
      date: client.date,
    };
  },
};
