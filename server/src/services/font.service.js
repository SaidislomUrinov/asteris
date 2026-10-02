const crypto = require("crypto");
const Font = require("../models/Font");
const fileUtil = require("../utils/file.util");
const { FOLDERS } = require("../configs/folder.config");
const { getNow } = require("../utils/date.util");

const ALLOWED_EXT = [".ttf", ".otf", ".woff"];

const DTO = (f) => ({
  _id: f._id,
  name: f.name,
  family: f.family,
  fileUrl: f.fileUrl,
  date: f.date,
});

module.exports = {
  DTO,

  create: async (body, file) => {
    const name = String(body?.name || "").trim();
    if (!name) throw new Error("font.fillTheRows");
    if (!file) throw new Error("font.fileRequired");

    const ext = (file.name.match(/\.[^.]+$/)?.[0] || "").toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) throw new Error("font.invalidFormat");

    const fileUrl = await fileUtil.save(file, FOLDERS.FONTS, name);
    // `family` — CSS/jsPDF uchun noyob identifikator, hujjat yaratilishidan
    // OLDIN generatsiya qilinadi (tasodifiy hex) — `_id`ga bog'lab keyin
    // to'ldirishga hojat yo'q, va schema'dagi `required` validatsiyasi ham
    // bir bosqichli create'da darhol qanoatlantiriladi.
    const family = `font-${crypto.randomBytes(6).toString("hex")}`;
    const doc = await Font.create({ name, family, fileUrl });

    return DTO(doc);
  },

  list: async () => {
    const rows = await Font.find({ isDeleted: false }).sort({ createdAt: -1 });
    return rows.map(DTO);
  },

  remove: async (id) => {
    const doc = await Font.findOne({ _id: id, isDeleted: false });
    if (!doc) throw new Error("font.notFound");
    doc.isDeleted = true;
    doc.deletedAt = getNow();
    await doc.save();
    return DTO(doc);
  },
};
