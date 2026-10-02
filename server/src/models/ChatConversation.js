const { Schema, model } = require("mongoose");

// Suhbat ishtirokchisi — Client Owner YOKI aniq bitta Staff. Ikkalasi
// mustaqil model (CLAUDE.md "Autentifikatsiya"), shuning uchun `refPath`
// emas, id + kind + snapshot (ChatMessage.sender bilan bir xil naqsh).
// `name`/`role`/`centerName` admin ro'yxatida "kim yozyapti" ni ko'rsatish
// uchun — har xabarda yangilanadi (hodim ismi/roli o'zgarsa ham to'g'ri).
const participantSchema = new Schema(
  {
    kind: { type: String, enum: ["client", "staff"], required: true },
    id: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, default: "" },
    // faqat staff uchun: reception | teacher | assistant
    role: { type: String, default: "" },
    centerId: { type: Schema.Types.ObjectId, default: null },
    centerName: { type: String, default: "" },
  },
  { _id: false },
);

// Bitta hujjat = bitta ODAM bilan suhbat (Telegram uslubi): Client Owner'ning
// o'z suhbati, har bir Staff'ning o'z suhbati. Ilgari butun Client uchun
// bitta umumiy suhbat edi — bir nechta hodim bir chatga yozib aralashib
// ketardi (2026-09-26). Eski suhbatlar Owner'ga biriktirilgan
// (scripts/migrate-chat-participants.js).
const schema = new Schema(
  {
    clientId: {
      type: Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },
    participant: { type: participantSchema, required: true },
    lastMessageAt: { type: Date, default: null },
    lastMessagePreview: { type: String, default: "" },
    clientUnreadCount: { type: Number, default: 0 },
    adminUnreadCount: { type: Number, default: 0 },
    // 1 soatlik avto-javob shu tsikl uchun allaqachon yuborilganmi.
    autoReplySentAt: { type: Date, default: null },
    status: { type: String, enum: ["open", "closed"], default: "open" },
  },
  { timestamps: true },
);

schema.index({ clientId: 1, "participant.kind": 1, "participant.id": 1 }, { unique: true });

module.exports = model("ChatConversation", schema);
