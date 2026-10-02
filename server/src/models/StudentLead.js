const { Schema, model } = require("mongoose");
const { formatDate, getNow } = require("../utils/date.util");
const { normalizeTelegramPhone, setTelegramPhone } = require("../utils/phone.util");

// Markazga o'qish uchun kelgan odamning arizasi (API_CONTRACT_student_leads.md).
// Platforma darajasidagi `Lead` (wenet.uz → Admin) bilan aralashtirilmaydi.
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const TIMES = ["any", "morning", "afternoon", "evening"];
const SOURCES = ["walkIn", "phone", "instagram", "telegram", "friend", "banner", "website", "other"];
const STATUSES = ["new", "contacted", "enrolled", "rejected"];

const schema = new Schema({
  client: { type: Schema.Types.ObjectId, ref: "Client", required: true },
  center: { type: Schema.Types.ObjectId, ref: "Center", required: true },
  subject: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
  fullName: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  parentPhone: { type: String, default: "", trim: true },
  // Telegram raqamlari — Student bilan bir xil invariant
  // (API_CONTRACT_telegram_phone.md §1), enroll'da o'quvchiga ko'chadi.
  telegramSame: { type: Boolean, default: true },
  telegramPhone: { type: String, default: "", trim: true, set: setTelegramPhone },
  parentTelegramSame: { type: Boolean, default: true },
  parentTelegramPhone: { type: String, default: "", trim: true, set: setTelegramPhone },
  preferredDays: { type: [String], enum: DAYS, default: [] },
  preferredTime: { type: String, enum: TIMES, default: "any" },
  level: { type: String, default: "", trim: true },
  source: { type: String, enum: SOURCES, default: "walkIn" },
  note: { type: String, default: "", trim: true },
  status: { type: String, enum: STATUSES, default: "new" },
  // Guruhga qo'shilgach — qaysi o'quvchi hujjati va guruhga aylangani.
  student: { type: Schema.Types.ObjectId, ref: "Student", default: null },
  group: { type: Schema.Types.ObjectId, ref: "Group", default: null },
  enrolledAt: { type: Number, default: null },
  createdBy: {
    id: { type: Schema.Types.ObjectId, default: null },
    kind: { type: String, default: "" },
    name: { type: String, default: "" },
  },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Number, default: null },
  createdAt: { type: Number, default: getNow },
  updatedAt: { type: Number, default: getNow },
});

schema.pre("save", async function () {
  this.updatedAt = getNow();
  // Xavfsizlik to'ri: invariant asosan `applyTelegramFields` orqali yoziladi,
  // lekin seed/skript kabi boshqa yo'llarda ham `*Same === true` bo'lsa
  // Telegram raqami telefon bilan sinxron qoladi (API_CONTRACT_telegram_phone.md §1).
  if (this.telegramSame !== false) this.telegramPhone = normalizeTelegramPhone(this.phone) || "";
  if (this.parentTelegramSame !== false) {
    this.parentTelegramPhone = normalizeTelegramPhone(this.parentPhone) || "";
  }
});

schema.virtual("date").get(function () {
  return formatDate(this.createdAt);
});

schema.statics.DAYS = DAYS;
schema.statics.TIMES = TIMES;
schema.statics.SOURCES = SOURCES;
schema.statics.STATUSES = STATUSES;

schema.index({ client: 1, center: 1, isDeleted: 1, status: 1, subject: 1 });
schema.index({ telegramPhone: 1 }, { partialFilterExpression: { telegramPhone: { $gt: "" } } });
schema.index({ parentTelegramPhone: 1 }, { partialFilterExpression: { parentTelegramPhone: { $gt: "" } } });

module.exports = model("StudentLead", schema);
