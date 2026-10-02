const { Schema, model } = require("mongoose");
const { getNow, formatDate } = require("../utils/date.util");

// Platforma darajasidagi resurs — Platform Admin yuklaydi, BARCHA
// tenant (Client/Staff) sertifikat konstruktorida ishlatadi. Shu sabab
// `client`/`center` maydoni YO'Q — Center/CertificateTemplate'dan farqli.
// `family` — CSS `font-family` va jsPDF `addFont` uchun ISHLATILADIGAN
// noyob identifikator, admin kiritmaydi, `font.service.js#create`da
// tasodifiy hex asosida avtomatik hosil qilinadi — shu bilan ikki xil
// shrift to'qnashib qolmasligi kafolatlanadi.
const schema = new Schema({
  name: { type: String, required: true, trim: true },
  family: { type: String, required: true, unique: true },
  fileUrl: { type: String, required: true },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Number, default: null },
  createdAt: { type: Number, default: getNow },
});

schema.virtual("date").get(function () {
  return formatDate(this.createdAt);
});

module.exports = model("Font", schema);
