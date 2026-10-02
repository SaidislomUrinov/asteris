const { Schema, model } = require("mongoose");

// Platforma darajasidagi resurs — Font.js bilan bir xil naqsh: Platform
// Admin yuklaydi, BARCHA tenant (Client/Staff) o'qiydi. Shu sabab
// `clientId`/`centerId` YO'Q — video bo'lim (sectionKey) darajasida, tenant
// bilan bog'liq emas.
const schema = new Schema(
  {
    sectionKey: { type: String, required: true, unique: true, trim: true },
    youtubeUrl: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

module.exports = model("TutorialVideo", schema);
