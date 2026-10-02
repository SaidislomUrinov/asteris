const { Schema, model } = require("mongoose");
const { getNow } = require("../utils/date.util");

// Yangilik (API_CONTRACT_news.md §1). Platforma resursi — TutorialVideo/Font
// bilan bir xil naqsh: Platform Admin yozadi, BARCHA tenant (Client Owner +
// Staff) o'qiydi. Shu sabab `clientId`/`centerId` YO'Q. O'qilganlik esa har
// foydalanuvchi uchun alohida — `NewsRead` modelida.
const LEVELS = ["important", "critical"];
const AUDIENCES = ["all", "owners", "staff"];
const STATUSES = ["draft", "published"];
const MEDIA_TYPES = ["image", "video", "youtube"];
const RESOURCE_KINDS = ["internal", "external"];

const mediaSchema = new Schema(
  {
    type: { type: String, enum: MEDIA_TYPES, required: true },
    // image/video: "/uploads/news/<file>" ; youtube: asl havola
    url: { type: String, required: true, trim: true },
    // Faqat type=youtube — server hisoblaydi (11 belgi)
    youtubeId: { type: String, default: null },
  },
  { _id: false },
);

const resourceSchema = new Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 80 },
    url: { type: String, required: true, trim: true },
    kind: { type: String, enum: RESOURCE_KINDS, required: true },
  },
  { _id: false },
);

const schema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    // Sanitize qilingan HTML (richText.util.sanitizeNewsHtml)
    description: { type: String, default: "" },
    // Tartib muhim — birinchisi muqova
    media: { type: [mediaSchema], default: [] },
    resources: { type: [resourceSchema], default: [] },
    level: { type: String, enum: LEVELS, default: "important" },
    audience: { type: String, enum: AUDIENCES, default: "all" },
    status: { type: String, enum: STATUSES, default: "draft" },
    publishedAt: { type: Number, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Admin", default: null },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Number, default: null },
    // Loyihadagi barcha sanalar Number (unix, getNow) — Client/Staff.createdAt
    // bilan solishtirish (visibility) shu sabab bir xil turda bo'lishi kerak.
    createdAt: { type: Number },
    updatedAt: { type: Number },
  },
  { timestamps: { currentTime: getNow } },
);

schema.index({ status: 1, isDeleted: 1, publishedAt: -1 });

const News = model("News", schema);
News.LEVELS = LEVELS;
News.AUDIENCES = AUDIENCES;
News.STATUSES = STATUSES;
News.MEDIA_TYPES = MEDIA_TYPES;
News.RESOURCE_KINDS = RESOURCE_KINDS;

module.exports = News;
