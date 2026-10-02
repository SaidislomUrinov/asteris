const { Schema, model } = require("mongoose");
const { getNow, formatDate } = require("../utils/date.util");

const STATUSES = ["pending", "contacted", "rejected", "confirmed", "recontact"];
const PLATFORMS = [
  "website",
  "google",
  "instagram",
  "facebook",
  "telegram",
  "other",
];

const statusHistorySchema = new Schema(
  {
    from: {
      type: String,
      enum: STATUSES,
      default: null,
    },
    to: {
      type: String,
      enum: STATUSES,
      required: true,
    },
    comment: String,
    changedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    changedAt: {
      type: Number,
      default: getNow,
    },
  },
  { _id: false },
);

const schema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  comment: String,
  // Telegram foydalanuvchi nomi/raqami — ixtiyoriy, faqat kontakt sifatida
  // ko'rsatiladi (platform:"telegram" — lead QAYERDAN kelgani, bu maydon
  // esa YOZISH mumkin bo'lgan qo'shimcha aloqa kanali, ikkalasi mustaqil).
  telegram: {
    type: String,
    trim: true,
    default: "",
  },
  platform: {
    type: String,
    enum: PLATFORMS,
    required: true,
  },
  platformNote: String, // platform:"other" bo'lganda yoki qo'shimcha tafsilot uchun
  // Saytdan kelgan lead uchun avtomatik yig'iladigan manba ma'lumoti. `platform`
  // — admin ko'radigan yirik kanal (google/instagram/...), bu esa aynan qaysi
  // havola ishlaganini ko'rsatadi. Foydalanuvchi kiritmaydi, frontend yuboradi.
  source: {
    utmSource: { type: String, trim: true, default: "" },
    utmMedium: { type: String, trim: true, default: "" },
    utmCampaign: { type: String, trim: true, default: "" },
    referrer: { type: String, trim: true, default: "" },
    landingPage: { type: String, trim: true, default: "" },
  },
  status: {
    type: String,
    enum: STATUSES,
    default: "pending",
  },
  client: {
    type: Schema.Types.ObjectId,
    ref: "Client",
    default: null,
  }, // lead Client'ga aylantirilganda biriktiriladi
  statusHistory: [statusHistorySchema],
  createdAt: {
    type: Number,
    default: getNow,
  },
  updatedAt: {
    type: Number,
    default: getNow,
  },
});

schema.pre("save", async function () {
  this.updatedAt = getNow();
});

schema.virtual("date").get(function () {
  return formatDate(this.createdAt);
});

schema.virtual("lastUpdate").get(function () {
  return formatDate(this.updatedAt);
});

schema.statics.STATUSES = STATUSES;
schema.statics.PLATFORMS = PLATFORMS;

module.exports = model("Lead", schema);
