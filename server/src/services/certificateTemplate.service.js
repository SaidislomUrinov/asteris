const CertificateTemplate = require("../models/CertificateTemplate");
const Center = require("../models/Center");
const fileUtil = require("../utils/file.util");
const { FOLDERS } = require("../configs/folder.config");
const { log: auditLog } = require("../utils/audit.util");
const { getNow } = require("../utils/date.util");

// Fiksirlangan konstanta — TARIF LIMITI EMAS (syllabus.service.js'dagi
// MAX_MODULES kabi). Har bir Center (filial) alohida hisoblanadi.
const MAX_TEMPLATES_PER_CENTER = 10;

const DTO = (t) => ({
  _id: t._id,
  client: t.client,
  center: t.center,
  name: t.name,
  backgroundUrl: t.backgroundUrl,
  fields: t.fields,
  date: t.date,
  lastUpdate: t.updatedAt,
});

module.exports = {
  DTO,

  create: async (clientId, centerId, body, file, actor) => {
    const center = await Center.findOne({ _id: centerId, client: clientId, isDeleted: false });
    if (!center) throw new Error("center.notFound");

    const name = String(body?.name || "").trim();
    if (!name) throw new Error("certificateTemplate.fillTheRows");
    if (!file) throw new Error("certificateTemplate.backgroundRequired");

    const count = await CertificateTemplate.countDocuments({
      client: clientId,
      center: centerId,
      isDeleted: false,
    });
    if (count >= MAX_TEMPLATES_PER_CENTER) throw new Error("certificateTemplate.limitReached");

    let fields = [];
    try {
      fields = JSON.parse(body?.fields || "[]");
    } catch {
      throw new Error("certificateTemplate.invalidFields");
    }

    const backgroundUrl = await fileUtil.save(file, FOLDERS.CERTIFICATES, name);

    const doc = await CertificateTemplate.create({
      client: clientId,
      center: centerId,
      name,
      backgroundUrl,
      fields,
    });

    await auditLog({
      actor,
      client: clientId,
      center: centerId,
      action: "certificateTemplate:created",
      entity: { type: "CertificateTemplate", id: doc._id, label: name },
    });

    return DTO(doc);
  },

  list: async (clientId, centerId) => {
    const filter = { client: clientId, isDeleted: false };
    if (centerId) filter.center = centerId;
    const rows = await CertificateTemplate.find(filter).sort({ createdAt: -1 });
    return { data: rows.map(DTO), limit: MAX_TEMPLATES_PER_CENTER };
  },

  getOne: async (clientId, id) => {
    const doc = await CertificateTemplate.findOne({ _id: id, client: clientId, isDeleted: false });
    if (!doc) throw new Error("certificateTemplate.notFound");
    return DTO(doc);
  },

  update: async (clientId, id, body, file) => {
    const doc = await CertificateTemplate.findOne({ _id: id, client: clientId, isDeleted: false });
    if (!doc) throw new Error("certificateTemplate.notFound");

    if (body?.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) throw new Error("certificateTemplate.fillTheRows");
      doc.name = name;
    }

    if (body?.fields !== undefined) {
      try {
        doc.fields = JSON.parse(body.fields);
      } catch {
        throw new Error("certificateTemplate.invalidFields");
      }
    }

    if (file) {
      const oldBackground = doc.backgroundUrl;
      doc.backgroundUrl = await fileUtil.save(file, FOLDERS.CERTIFICATES, doc.name);
      if (oldBackground) await fileUtil.remove(oldBackground);
    }

    await doc.save();
    return DTO(doc);
  },

  remove: async (clientId, id, actor) => {
    const doc = await CertificateTemplate.findOne({ _id: id, client: clientId, isDeleted: false });
    if (!doc) throw new Error("certificateTemplate.notFound");
    doc.isDeleted = true;
    doc.deletedAt = getNow();
    await doc.save();

    await auditLog({
      actor,
      client: clientId,
      center: doc.center,
      action: "certificateTemplate:deleted",
      entity: { type: "CertificateTemplate", id: doc._id, label: doc.name },
    });

    return DTO(doc);
  },

  MAX_TEMPLATES_PER_CENTER,
};
