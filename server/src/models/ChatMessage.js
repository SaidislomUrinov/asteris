const { Schema, model } = require("mongoose");

// Yuboruvchi Admin/Client/Staff/System — hammasi MUSTAQIL model (CLAUDE.md
// "Autentifikatsiya"), shuning uchun `refPath` emas, id + kind + name
// snapshot (Notification.recipient / AuditLog.actor bilan bir xil naqsh).
const senderSchema = new Schema(
  {
    kind: { type: String, enum: ["client", "staff", "admin", "system"], required: true },
    id: { type: Schema.Types.ObjectId, default: null },
    name: { type: String, default: "" },
  },
  { _id: false },
);

const schema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "ChatConversation",
      required: true,
    },
    // tenant isolation uchun duplikat, har queryda filtr
    clientId: { type: Schema.Types.ObjectId, required: true },
    sender: { type: senderSchema, required: true },
    type: { type: String, enum: ["text", "image"], required: true },
    text: { type: String, default: "" },
    // "html" — faqat admin tomonidan yuborilishi mumkin (rich-text composer:
    // b/i, ul/ol, blockquote, a). `text` shu holda sanitizatsiya qilingan
    // HTML'ni saqlaydi, klient `dangerouslySetInnerHTML` bilan ko'rsatadi.
    format: { type: String, enum: ["text", "html"], default: "text" },
    imageUrl: { type: String, default: "" },
    readByAdmin: { type: Boolean, default: false },
    readByClient: { type: Boolean, default: false },
  },
  { timestamps: true },
);

schema.index({ conversationId: 1, createdAt: 1 });

module.exports = model("ChatMessage", schema);
