const Subject = require("../models/Subject");
const Center = require("../models/Center");
const { getNow } = require("../utils/date.util");

const PAGE_SIZE = 50;

const DTO = (data) => ({
  _id: data?._id,
  client: data?.client,
  center: data?.center,
  name: data?.name,
  price: data?.price,
  durationMonths: data?.durationMonths,
  date: data?.date,
  lastUpdate: data?.lastUpdate,
});

module.exports = {
  DTO,

  create: async (clientId, body) => {
    const { centerId, name, price, durationMonths } = body;
    if (!centerId || !name || price == null || durationMonths == null) {
      throw new Error("subject.fillTheRows");
    }
    if (price < 0 || durationMonths < 1) throw new Error("subject.invalidValue");

    const center = await Center.findOne({ _id: centerId, client: clientId, isDeleted: false });
    if (!center) throw new Error("center.notFound");

    const subject = await Subject.create({
      client: clientId,
      center: center._id,
      name: name.trim(),
      price,
      durationMonths,
    });

    return DTO(subject);
  },

  list: async (clientId, { page = 1, search = "", center = "" }) => {
    const trimmedSearch = search?.trim();
    const baseFilter = { client: clientId, isDeleted: false };
    if (center) baseFilter.center = center;

    if (trimmedSearch) {
      const regex = new RegExp(trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const data = await Subject.find({
        ...baseFilter,
        name: regex,
      }).sort({ createdAt: -1 });

      return {
        data: data.map(DTO),
        meta: { page: 1, limit: data.length, total: data.length, totalPages: 1 },
      };
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const skip = (pageNum - 1) * PAGE_SIZE;

    const [data, total] = await Promise.all([
      Subject.find(baseFilter).sort({ createdAt: -1 }).skip(skip).limit(PAGE_SIZE),
      Subject.countDocuments(baseFilter),
    ]);

    return {
      data: data.map(DTO),
      meta: {
        page: pageNum,
        limit: PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / PAGE_SIZE) || 1,
      },
    };
  },

  getOne: async (clientId, id) => {
    const subject = await Subject.findOne({ _id: id, client: clientId, isDeleted: false });
    if (!subject) throw new Error("subject.notFound");
    return DTO(subject);
  },

  // Excel export — list() bilan bir xil filtr, sahifalashsiz, Filial nomi
  // hal qilingan holda.
  exportList: async (clientId, { search = "", center = "" }) => {
    const trimmedSearch = search?.trim();
    const baseFilter = { client: clientId, isDeleted: false };
    if (center) baseFilter.center = center;
    if (trimmedSearch) {
      const regex = new RegExp(trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      baseFilter.name = regex;
    }

    const subjects = await Subject.find(baseFilter).sort({ createdAt: -1 });
    const centerIds = [...new Set(subjects.map((s) => String(s.center)))];
    const centers = await Center.find({ _id: { $in: centerIds } }, { name: 1 });
    const centerMap = Object.fromEntries(centers.map((c) => [String(c._id), c.name]));

    return subjects.map((s) => ({
      name: s.name,
      price: s.price,
      durationMonths: s.durationMonths,
      centerName: centerMap[String(s.center)] || "—",
      date: s.date,
    }));
  },

  update: async (clientId, id, body) => {
    const subject = await Subject.findOne({ _id: id, client: clientId, isDeleted: false });
    if (!subject) throw new Error("subject.notFound");

    if (body.name) subject.name = body.name.trim();

    if (body.centerId) {
      const center = await Center.findOne({
        _id: body.centerId,
        client: clientId,
        isDeleted: false,
      });
      if (!center) throw new Error("center.notFound");
      subject.center = center._id;
    }

    if (body.price != null) {
      if (body.price < 0) throw new Error("subject.invalidValue");
      subject.price = body.price;
    }

    if (body.durationMonths != null) {
      if (body.durationMonths < 1) throw new Error("subject.invalidValue");
      subject.durationMonths = body.durationMonths;
    }

    await subject.save();
    return DTO(subject);
  },

  remove: async (clientId, id) => {
    const subject = await Subject.findOne({ _id: id, client: clientId, isDeleted: false });
    if (!subject) throw new Error("subject.notFound");

    subject.isDeleted = true;
    subject.deletedAt = getNow();
    await subject.save();

    return true;
  },
};
