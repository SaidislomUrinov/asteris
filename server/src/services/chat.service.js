const ChatConversation = require("../models/ChatConversation");
const ChatMessage = require("../models/ChatMessage");
const Client = require("../models/Client");
const Admin = require("../models/Admin");
const Center = require("../models/Center");
const fileUtil = require("../utils/file.util");
const { FOLDERS } = require("../configs/folder.config");
const emit = require("../utils/emitter.util");
const { getAdminIo } = require("../configs/socket.config");
const { getNow } = require("../utils/date.util");
const { sanitizeChatHtml, stripHtml } = require("../utils/richText.util");

const MESSAGE_LIMIT = 50;
const PAGE_LIMIT = 30;

// Mijoz birinchi marta yozganda YOKI oxirgi o'z xabaridan 1 soatdan ko'proq
// vaqt o'tgach qayta yozganda — darhol (kutilmasdan) yuboriladigan avto-javob.
// `sender.kind:"system"` bilan saqlanadi, lekin frontendda "admin" bilan bir
// xil ko'rinishda ko'rsatiladi (maxsus pill emas) — go'yo admin tarafdan
// kelganday.
const AUTO_REPLY_TEXT =
  "Moderatorlarimiz 30-60 daqiqa ichida siz bilan aloqaga chiqishadi.";
const AUTO_REPLY_GAP_MS = 60 * 60 * 1000; // 1 soat

// Admin panelidagi "Avto javob" tugmasi — tanlangan til bo'yicha shablon
// xabar yuboradi (haqiqiy admin nomidan, kind:"admin").
const GREETING_TEMPLATES = {
  uz: "Assalomu alaykum! Men sizning murojaatingiz bo'yicha ishni boshladim, barcha ma'lumotlar bilan tanishib chiqishim uchun biroz vaqt kerak bo'ladi. Bir necha daqiqadan so'ng sizga qaytaman.",
  uzc: "Ассалому алайкум! Мен сизнинг мурожаатингиз бўйича ишни бошладим, барча маълумотлар билан танишиб чиқишим учун бироз вақт керак бўлади. Бир неча дақиқадан сўнг сизга қайтаман.",
  ru: "Здравствуйте! Я начал работу по Вашему обращению, мне потребуется некоторое время для ознакомления со всей информацией. Вернусь к Вам через пару минут.",
  en: "Hello! I've started working on your request — I'll need a little time to review all the details, and I'll get back to you in a couple of minutes.",
};

const conversationDTO = (c) => ({
  _id: c._id,
  clientId: c.clientId,
  participant: c.participant
    ? {
        kind: c.participant.kind,
        id: c.participant.id,
        name: c.participant.name || "",
        role: c.participant.role || "",
        centerId: c.participant.centerId || null,
        centerName: c.participant.centerName || "",
      }
    : null,
  lastMessageAt: c.lastMessageAt,
  lastMessagePreview: c.lastMessagePreview,
  clientUnreadCount: c.clientUnreadCount,
  adminUnreadCount: c.adminUnreadCount,
  autoReplySentAt: c.autoReplySentAt,
  status: c.status,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});

const messageDTO = (m) => ({
  _id: m._id,
  conversationId: m.conversationId,
  clientId: m.clientId,
  sender: m.sender,
  type: m.type,
  text: m.text,
  format: m.format || "text",
  imageUrl: m.imageUrl,
  readByAdmin: m.readByAdmin,
  readByClient: m.readByClient,
  createdAt: m.createdAt,
});

// req.client / req.staff'dan kelib chiqib tenant isolation uchun clientId,
// xabar yuboruvchi snapshoti va suhbat ishtirokchisini aniqlaydi. `tenantAuth`
// staff bo'lsa ham `req.client._id`ni tenant clientId'ga o'rnatib qo'yadi.
// Har odam (Owner / har Staff) o'z alohida suhbatiga ega (Telegram uslubi).
const resolveSender = async (req) => {
  if (req.staff) {
    const center = req.staff.center
      ? await Center.findById(req.staff.center).select("name")
      : null;
    return {
      clientId: req.client._id,
      sender: { kind: "staff", id: req.staff._id, name: req.staff.name || "" },
      participant: {
        kind: "staff",
        id: req.staff._id,
        name: req.staff.name || "",
        role: req.staff.role || "",
        centerId: req.staff.center || null,
        centerName: center?.name || "",
      },
    };
  }
  return {
    clientId: req.client._id,
    sender: { kind: "client", id: req.client._id, name: req.client.name || "" },
    participant: {
      kind: "client",
      id: req.client._id,
      name: req.client.name || "",
      role: "",
      centerId: null,
      centerName: "",
    },
  };
};

// Ishtirokchining suhbatini topadi yoki yaratadi. Ism/rol/filial snapshoti
// har safar yangilanadi — admin ro'yxatida doim joriy ma'lumot ko'rinadi.
const getOrCreateConversation = async (clientId, participant) => {
  const filter = {
    clientId,
    "participant.kind": participant.kind,
    "participant.id": participant.id,
  };
  const update = {
    $set: {
      "participant.name": participant.name,
      "participant.role": participant.role,
      "participant.centerId": participant.centerId,
      "participant.centerName": participant.centerName,
    },
  };
  try {
    return await ChatConversation.findOneAndUpdate(filter, update, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
  } catch (error) {
    // Bir vaqtda ikki so'rov yaratmoqchi bo'lsa — unique indeks ikkinchisini
    // rad etadi, u holda birinchisi yaratgan hujjat olinadi.
    if (error?.code === 11000) return ChatConversation.findOne(filter);
    throw error;
  }
};

// Xabar faqat suhbat egasiga (uning barcha qurilmalariga) boradi — butun
// Client xonasiga emas. Owner socket'ida `userId === clientId`, Staff'da —
// staffId (socket.config.js "authenticateClientSocket").
const emitToParticipant = (conversation, event, payload) => {
  emit(`user:${conversation.participant?.id || conversation.clientId}`, event, payload);
};

const emitConversationUpdated = async (conversation) => {
  const client = await Client.findById(conversation.clientId).select("name phone");
  emitToAdmin("chat:conversationUpdated", {
    conversation: {
      ...conversationDTO(conversation),
      clientName: client?.name || "",
      clientPhone: client?.phone || "",
    },
  });
};

const emitToAdmin = (event, payload) => {
  try {
    getAdminIo().emit(event, payload);
  } catch {
    // Admin socket hali ko'tarilmagan bo'lishi mumkin — ma'lumot baribir saqlangan.
  }
};

// Yangi mijoz xabaridan SO'NG chaqiriladi: shu xabardan oldingi oxirgi
// client/staff xabarini topadi. Topilmasa (birinchi xabar) yoki orasidan
// 1 soatdan ko'p o'tgan bo'lsa — avto-javob shu zahoti qo'shiladi.
const maybeSendAutoReply = async (conversation, newMessage) => {
  const prevClientMessage = await ChatMessage.findOne({
    conversationId: conversation._id,
    _id: { $ne: newMessage._id },
    "sender.kind": { $in: ["client", "staff"] },
  }).sort({ createdAt: -1 });

  const gapTooLong =
    prevClientMessage &&
    new Date(newMessage.createdAt).getTime() -
      new Date(prevClientMessage.createdAt).getTime() >=
      AUTO_REPLY_GAP_MS;

  if (prevClientMessage && !gapTooLong) return null;

  const autoMessage = await ChatMessage.create({
    conversationId: conversation._id,
    clientId: conversation.clientId,
    sender: { kind: "system", id: null, name: "" },
    type: "text",
    text: AUTO_REPLY_TEXT,
  });

  conversation.autoReplySentAt = autoMessage.createdAt;
  conversation.lastMessageAt = autoMessage.createdAt;
  conversation.lastMessagePreview = AUTO_REPLY_TEXT;
  conversation.clientUnreadCount += 1;
  await conversation.save();

  const dto = messageDTO(autoMessage);
  emitToParticipant(conversation, "chat:message", { message: dto });
  emitToAdmin("chat:message", { conversationId: conversation._id, message: dto });
  await emitConversationUpdated(conversation);

  return dto;
};

module.exports = {
  DTO: conversationDTO,
  messageDTO,

  // ---- Client/Staff tomoni ----

  getMyConversation: async (req) => {
    const { clientId, participant } = await resolveSender(req);
    const conversation = await getOrCreateConversation(clientId, participant);
    const messages = await ChatMessage.find({ conversationId: conversation._id })
      .sort({ createdAt: -1 })
      .limit(MESSAGE_LIMIT);

    return {
      conversation: conversationDTO(conversation),
      messages: messages.reverse().map(messageDTO),
    };
  },

  getMyMessages: async (req, query) => {
    const { clientId, participant } = await resolveSender(req);
    const conversation = await getOrCreateConversation(clientId, participant);

    const filter = { conversationId: conversation._id };
    if (query?.before) filter._id = { $lt: query.before };

    const limit = Math.min(Number(query?.limit) || PAGE_LIMIT, 100);
    const messages = await ChatMessage.find(filter).sort({ createdAt: -1 }).limit(limit);

    return { messages: messages.reverse().map(messageDTO) };
  },

  sendMyText: async (req, text) => {
    text = String(text || "").trim();
    if (!text) throw new Error("chat.textRequired");

    const { clientId, sender, participant } = await resolveSender(req);
    const conversation = await getOrCreateConversation(clientId, participant);

    const message = await ChatMessage.create({
      conversationId: conversation._id,
      clientId,
      sender,
      type: "text",
      text,
    });

    conversation.lastMessageAt = getNow() * 1000;
    conversation.lastMessagePreview = text;
    conversation.adminUnreadCount += 1;
    conversation.status = "open";
    await conversation.save();

    const dto = messageDTO(message);
    emitToParticipant(conversation, "chat:message", { message: dto });
    emitToAdmin("chat:message", { conversationId: conversation._id, message: dto });
    await emitConversationUpdated(conversation);

    await maybeSendAutoReply(conversation, message);

    return dto;
  },

  sendMyImage: async (req, file) => {
    if (!file) throw new Error("chat.imageRequired");

    const { clientId, sender, participant } = await resolveSender(req);
    const conversation = await getOrCreateConversation(clientId, participant);

    const imageUrl = await fileUtil.save(file, FOLDERS.CHAT_IMAGES, `chat-${clientId}`);

    const message = await ChatMessage.create({
      conversationId: conversation._id,
      clientId,
      sender,
      type: "image",
      imageUrl,
    });

    conversation.lastMessageAt = getNow() * 1000;
    conversation.lastMessagePreview = "📷 Rasm";
    conversation.adminUnreadCount += 1;
    conversation.status = "open";
    await conversation.save();

    const dto = messageDTO(message);
    emitToParticipant(conversation, "chat:message", { message: dto });
    emitToAdmin("chat:message", { conversationId: conversation._id, message: dto });
    await emitConversationUpdated(conversation);

    await maybeSendAutoReply(conversation, message);

    return dto;
  },

  markReadByClient: async (req) => {
    const { clientId, participant } = await resolveSender(req);
    const conversation = await getOrCreateConversation(clientId, participant);

    await ChatMessage.updateMany(
      { conversationId: conversation._id, readByClient: false },
      { $set: { readByClient: true } },
    );
    conversation.clientUnreadCount = 0;
    await conversation.save();

    emitToParticipant(conversation, "chat:read", { conversationId: conversation._id, readByClient: true });
    emitToAdmin("chat:read", { conversationId: conversation._id, readByClient: true });

    return { ok: true };
  },

  // ---- Admin tomoni ----

  listConversations: async (query) => {
    const filter = {};
    if (query?.status) filter.status = query.status;

    // Qidiruv: markaz (Client) nomi YOKI yozayotgan odamning ismi bo'yicha.
    if (query?.search) {
      const pattern = String(query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const clients = await Client.find({
        isDeleted: false,
        name: { $regex: pattern, $options: "i" },
      }).select("_id");
      filter.$or = [
        { clientId: { $in: clients.map((c) => c._id) } },
        { "participant.name": { $regex: pattern, $options: "i" } },
      ];
    }

    const conversations = await ChatConversation.find(filter)
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .populate({ path: "clientId", select: "name phone" });

    return {
      conversations: conversations.map((c) => ({
        ...conversationDTO(c),
        clientId: c.clientId?._id || c.clientId,
        clientName: c.clientId?.name || "",
        clientPhone: c.clientId?.phone || "",
      })),
    };
  },

  getConversationMessages: async (id, query) => {
    const conversation = await ChatConversation.findById(id).populate({
      path: "clientId",
      select: "name phone",
    });
    if (!conversation) throw new Error("chat.notFound");

    const filter = { conversationId: conversation._id };
    if (query?.before) filter._id = { $lt: query.before };

    const limit = Math.min(Number(query?.limit) || PAGE_LIMIT, 100);
    const messages = await ChatMessage.find(filter).sort({ createdAt: -1 }).limit(limit);

    return {
      conversation: {
        ...conversationDTO(conversation),
        clientId: conversation.clientId?._id || conversation.clientId,
        clientName: conversation.clientId?.name || "",
        clientPhone: conversation.clientId?.phone || "",
      },
      messages: messages.reverse().map(messageDTO),
    };
  },

  // `body.html` bo'lsa — rich-text composer (b/i, ul/ol, blockquote, a),
  // sanitizatsiya qilinib `format:"html"` bilan saqlanadi. Aks holda oddiy
  // matn (`format:"text"`, eski xatti-harakat).
  sendAdminText: async (id, adminId, body) => {
    const rawHtml = typeof body === "object" ? body?.html : null;
    const rawText = typeof body === "object" ? body?.text : body;

    let text;
    let format = "text";
    if (rawHtml && String(rawHtml).trim()) {
      text = sanitizeChatHtml(rawHtml);
      if (!stripHtml(text)) throw new Error("chat.textRequired");
      format = "html";
    } else {
      text = String(rawText || "").trim();
      if (!text) throw new Error("chat.textRequired");
    }

    const conversation = await ChatConversation.findById(id);
    if (!conversation) throw new Error("chat.notFound");

    const admin = await Admin.findById(adminId).select("name");

    const message = await ChatMessage.create({
      conversationId: conversation._id,
      clientId: conversation.clientId,
      sender: { kind: "admin", id: adminId, name: admin?.name || "" },
      type: "text",
      text,
      format,
    });

    conversation.lastMessageAt = getNow() * 1000;
    conversation.lastMessagePreview = format === "html" ? stripHtml(text) : text;
    conversation.clientUnreadCount += 1;
    await conversation.save();

    const dto = messageDTO(message);
    emitToParticipant(conversation, "chat:message", { message: dto });
    emitToAdmin("chat:message", { conversationId: conversation._id, message: dto });
    await emitConversationUpdated(conversation);

    return dto;
  },

  sendAdminImage: async (id, adminId, file) => {
    if (!file) throw new Error("chat.imageRequired");

    const conversation = await ChatConversation.findById(id);
    if (!conversation) throw new Error("chat.notFound");

    const admin = await Admin.findById(adminId).select("name");
    const imageUrl = await fileUtil.save(file, FOLDERS.CHAT_IMAGES, `chat-${conversation.clientId}`);

    const message = await ChatMessage.create({
      conversationId: conversation._id,
      clientId: conversation.clientId,
      sender: { kind: "admin", id: adminId, name: admin?.name || "" },
      type: "image",
      imageUrl,
    });

    conversation.lastMessageAt = getNow() * 1000;
    conversation.lastMessagePreview = "📷 Rasm";
    conversation.clientUnreadCount += 1;
    await conversation.save();

    const dto = messageDTO(message);
    emitToParticipant(conversation, "chat:message", { message: dto });
    emitToAdmin("chat:message", { conversationId: conversation._id, message: dto });
    await emitConversationUpdated(conversation);

    return dto;
  },

  // Admin panelidagi "Avto javob" tugmasi — tanlangan til bo'yicha shablon
  // xabarni haqiqiy admin nomidan yuboradi (kind:"admin").
  sendGreeting: async (id, adminId, lang) => {
    const text = GREETING_TEMPLATES[lang];
    if (!text) throw new Error("chat.invalidLang");

    const conversation = await ChatConversation.findById(id);
    if (!conversation) throw new Error("chat.notFound");

    const admin = await Admin.findById(adminId).select("name");

    const message = await ChatMessage.create({
      conversationId: conversation._id,
      clientId: conversation.clientId,
      sender: { kind: "admin", id: adminId, name: admin?.name || "" },
      type: "text",
      text,
    });

    conversation.lastMessageAt = getNow() * 1000;
    conversation.lastMessagePreview = text;
    conversation.clientUnreadCount += 1;
    await conversation.save();

    const dto = messageDTO(message);
    emitToParticipant(conversation, "chat:message", { message: dto });
    emitToAdmin("chat:message", { conversationId: conversation._id, message: dto });
    await emitConversationUpdated(conversation);

    return dto;
  },

  markReadByAdmin: async (id) => {
    const conversation = await ChatConversation.findById(id);
    if (!conversation) throw new Error("chat.notFound");

    await ChatMessage.updateMany(
      { conversationId: conversation._id, readByAdmin: false },
      { $set: { readByAdmin: true } },
    );
    conversation.adminUnreadCount = 0;
    // Admin o'qiganda avto-javob timeri to'xtaydi (adminUnreadCount=0
    // bo'lgani uchun job keyingi tikda shartga tushmaydi).
    await conversation.save();

    emitToParticipant(conversation, "chat:read", {
      conversationId: conversation._id,
      readByAdmin: true,
    });
    emitToAdmin("chat:read", { conversationId: conversation._id, readByAdmin: true });

    return { ok: true };
  },
};
