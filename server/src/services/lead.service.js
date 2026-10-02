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
  telegram: data?.telegram,
  platform: data?.platform,
  platformNote: data?.platformNote,
  source: data?.source
    ? {
        utmSource: data.source.utmSource || "",
        utmMedium: data.source.utmMedium || "",
        utmCampaign: data.source.utmCampaign || "",
        referrer: data.source.referrer || "",
        landingPage: data.source.landingPage || "",
      }
    : null,
  status: data?.status,
  client: data?.client,
  statusHistory: (data?.statusHistory || []).map(historyDTO),
  date: data?.date,
  lastUpdate: data?.lastUpdate,
});

// Saytdan kelgan manba maydonlarini tozalaydi — foydalanuvchi yuborgan
// ma'lumot bo'lgani uchun uzunligi cheklanadi va faqat kutilgan kalitlar olinadi.
const SOURCE_MAX = 300;
const clip = (v) => String(v ?? "").trim().slice(0, SOURCE_MAX);

const sanitizeSource = (source) => {
  if (!source || typeof source !== "object") return undefined;
  const out = {
    utmSource: clip(source.utmSource),
    utmMedium: clip(source.utmMedium),
    utmCampaign: clip(source.utmCampaign),
    referrer: clip(source.referrer),
    landingPage: clip(source.landingPage),
  };
  return Object.values(out).some(Boolean) ? out : undefined;
};

// Telegram ogohlantirishi uchun bir qatorli manba matni: "instagram / cpc /
// sentabr-aksiya" yoki referrer. Bo'sh bo'lsa "to'g'ridan-to'g'ri".
const sourceLabel = (source) => {
  if (!source) return "to'g'ridan-to'g'ri";
  const utm = [source.utmSource, source.utmMedium, source.utmCampaign].filter(Boolean);
  if (utm.length) return utm.join(" / ");
  if (source.referrer) return source.referrer;
  return "to'g'ridan-to'g'ri";
};

const STATUS_LABELS = {
  pending: "Kutilmoqda",
  contacted: "Bog'lanildi",
  rejected: "Rad etildi",
  confirmed: "Tasdiqlandi",
  recontact: "Qayta aloqa",
};

const PLATFORM_LABELS = {
  website: "Veb-sayt",
  google: "Google",
  instagram: "Instagram",
  facebook: "Facebook",
  telegram: "Telegram",
  other: "Boshqa",
};

// Lead xabari `leadChatIds`ga (sotuv jamoasi) ketadi. FIRE-AND-FORGET —
// bot o'chiq bo'lsa ham lead yaratish/status o'zgartirish to'xtamaydi.
// Throttle yo'q: har bir lead va har bir status o'zgarishi alohida xabar.
// Telegram vaqtincha javob bermasa (tarmoq, 429) — lead yo'qolmasin deb
// bir necha marta qayta uriniladi; oxiri ham o'xshamasa pm2 logiga yoziladi.
const LEAD_ALERT_RETRY_DELAYS = [2000, 10000, 30000];

const sendLeadAlert = async (type, title, dto, extraMeta) => {
  const payload = {
    title,
    body: dto.name,
    meta: {
      Telefon: dto.phone,
      Telegram: dto.telegram || "",
      ...extraMeta,
    },
  };

  try {
    const { sendAlert } = require("../bot/alert");
    for (let attempt = 0; ; attempt++) {
      const result = await sendAlert(type, payload, { throttle: false, channel: "lead" });
      // skipped — sozlama bo'yicha ataylab yuborilmagan (bot o'chiq va h.k.)
      if (result.ok || result.skipped) return;
      if (attempt >= LEAD_ALERT_RETRY_DELAYS.length) {
        console.warn(`lead alert yuborilmadi (${type}, ${dto._id}):`, result.error);
        return;
      }
      await new Promise((r) => setTimeout(r, LEAD_ALERT_RETRY_DELAYS[attempt]));
    }
  } catch (error) {
    console.warn(`lead alert xatosi (${type}, ${dto._id}):`, error?.message || error);
  }
};

module.exports = {
  DTO,

  create: async (body) => {
    const { name, phone, comment, platform, platformNote, telegram, source } = body;

    if (!name || !phone || !platform) throw new Error("lead.fillTheRows");
    if (!Lead.PLATFORMS.includes(platform)) throw new Error("lead.invalidPlatform");

    const lead = await Lead.create({
      name: name.trim(),
      phone: phone.trim(),
      comment,
      telegram: telegram?.trim() || "",
      platform,
      platformNote,
      source,
    });

    const dto = DTO(lead);
    emitLead("lead:created", dto);

    sendLeadAlert("newLead", "Yangi lead", dto, {
      Platforma: PLATFORM_LABELS[dto.platform] || dto.platform,
      Manba: sourceLabel(dto.source),
      Izoh: dto.comment || "",
      Vaqt: dto.date,
    });

    return dto;
  },

  // Websitening "Bepul boshlash" modali shu orqali yuboradi — API-key TALAB
  // QILINMAYDI (haqiqiy tashrifchi brauzerdan chaqiradi), shuning uchun
  // `platform` bodydan OLINMAYDI, doim "website" deb qat'iy belgilanadi —
  // aks holda tashrifchi o'zboshimchalik bilan boshqa platforma qilib
  // ko'rsatishi mumkin edi. Route darajasida IP bo'yicha rate-limit bor.
  createPublic: async (body) => {
    const { name, phone, comment, telegram, source } = body;
    if (!name || !phone) throw new Error("lead.fillTheRows");

    const cleanSource = sanitizeSource(source);

    // Ochiq forma — uzunliklar cheklanadi (Telegram xabari 4096 belgidan
    // oshsa umuman yuborilmay qolardi).
    return module.exports.create({
      name: String(name).trim().slice(0, 100),
      phone: String(phone).trim().slice(0, 32),
      comment: String(comment ?? "").trim().slice(0, 2000),
      telegram: String(telegram ?? "").trim().slice(0, 64),
      // `platform` yuqoridagi sabab bo'yicha doim "website" — UTM ham
      // tashrifchi qo'lidagi ma'lumot, shuning uchun u kanalni O'ZGARTIRMAYDI,
      // faqat `source` ichida ma'lumot sifatida saqlanadi va adminda
      // "so'ralmagan, o'zi kelgan" ma'lumot sifatida ko'rsatiladi.
      platform: "website",
      source: cleanSource,
    });
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

    const last = dto.statusHistory[dto.statusHistory.length - 1];
    sendLeadAlert("leadStatus", "Lead statusi o'zgardi", dto, {
      Status: `${STATUS_LABELS[last?.from] || last?.from || "—"} → ${STATUS_LABELS[to] || to}`,
      Izoh: comment || "",
      "Lead izohi": dto.comment || "",
      "O'zgartirdi": last?.changedBy?.name || last?.changedBy?.username || "",
      Vaqt: last?.date || dto.lastUpdate,
    });

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
