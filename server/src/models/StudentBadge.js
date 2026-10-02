const { Schema, model } = require("mongoose");
const { getNow } = require("../utils/date.util");
const { BADGE_TYPES } = require("../utils/badge.util");

// O'quvchining guruhdagi oylik YUTUQ NISHONI (API_CONTRACT_badges_monthly_rank.md §C).
// Oy yakunida `jobs/badges.job.js` beradi. Yutuq tarixi — O'CHIRILMAYDI
// (arxiv semantikasi ham yo'q). Bir oyda bir turdan bitta (unique index,
// job qayta ishlasa ham takror yozuv tushmaydi).
const schema = new Schema({
  client: { type: Schema.Types.ObjectId, ref: "Client", required: true },
  center: { type: Schema.Types.ObjectId, ref: "Center", required: true },
  group: { type: Schema.Types.ObjectId, ref: "Group", required: true },
  student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
  // Student.groups[]._id — ota-ona WebApp havolasi shu a'zolik bo'yicha.
  entry: { type: Schema.Types.ObjectId, default: null },
  type: { type: String, enum: BADGE_TYPES, required: true },
  month: { type: String, required: true }, // "YYYY-MM"
  // Ko'rsatish uchun: { position, total, delta, average ... }
  meta: { type: Schema.Types.Mixed, default: {} },
  // Ota-onaga Telegram xabari ketdimi. Berish (tunda/ertalab) va xabar
  // (kunduzgi oyna) alohida bosqich — badge.service.notifyMonth. Bu maydon
  // qo'shilishidan oldingi yozuvlarda yo'q: `notified: false` so'rovi ularni
  // tanlamaydi (ular allaqachon xabar qilingan).
  notified: { type: Boolean, default: false },
  createdAt: { type: Number, default: getNow },
});

schema.index({ student: 1, group: 1, type: 1, month: 1 }, { unique: true });
schema.index({ client: 1, center: 1, group: 1, month: -1 });
schema.index({ student: 1, month: -1 });
schema.index({ month: 1, notified: 1 });

module.exports = model("StudentBadge", schema);
