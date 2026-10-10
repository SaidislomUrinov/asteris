const { Schema, model } = require("mongoose");

// Platforma darajasidagi resurs — Font.js bilan bir xil naqsh: Platform
// Admin yuklaydi, BARCHA tenant (Client/Staff) o'qiydi. Shu sabab
// `clientId`/`centerId` YO'Q — video bo'lim (sectionKey) darajasida, tenant
// bilan bog'liq emas.
// `title` — client "Video qo'llanmalar" sahifasidagi "#N Sarlavha";
// `order` — shu sahifadagi tartib (kichigi oldin), admin o'zgartiradi
// (docs/API_CONTRACT_tutorial_videos_v2.md).
const schema = new Schema(
  {
    sectionKey: { type: String, required: true, unique: true, trim: true },
    youtubeUrl: { type: String, required: true, trim: true },
    title: { type: String, trim: true, default: "", maxlength: 120 },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

module.exports = model("TutorialVideo", schema);
