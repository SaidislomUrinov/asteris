const Tariff = require("../models/Tariff");
const { getNow } = require("../utils/date.util");

const DTO = (data) => ({
  _id: data?._id,
  name: data?.name,
  price: data?.price,
  trialDays: data?.trialDays,
  studentLimit: data?.studentLimit,
  centerLimit: data?.centerLimit,
  teacherLimit: data?.teacherLimit,
  receptionLimit: data?.receptionLimit,
  allowedPermissions: data?.allowedPermissions,
  date: data?.date,
  lastUpdate: data?.lastUpdate,
});

// -1 qiymati "cheksiz" degani, shuning uchun pastki chegara 0 emas -1
const LIMIT_FIELDS = [
  "studentLimit",
  "centerLimit",
  "teacherLimit",
  "receptionLimit",
];

module.exports = {
  DTO,

  create: async (body) => {
    const { name, price, allowedPermissions, trialDays } = body;

    if (!name || price == null) throw new Error("tariff.fillTheRows");
    if (Number(price) < 0) throw new Error("tariff.invalidPrice");
    if (trialDays != null && Number(trialDays) < 0) {
      throw new Error("tariff.invalidLimit");
    }

    for (const field of LIMIT_FIELDS) {
      if (body[field] == null || Number(body[field]) < -1) {
        throw new Error("tariff.fillTheRows");
      }
    }

    const tariff = await Tariff.create({
      name: name.trim(),
      price,
      trialDays: trialDays || 0,
      studentLimit: body.studentLimit,
      centerLimit: body.centerLimit,
      teacherLimit: body.teacherLimit,
      receptionLimit: body.receptionLimit,
      allowedPermissions: allowedPermissions || [],
    });

    return DTO(tariff);
  },

  list: async () => {
    const data = await Tariff.find({ isDeleted: false }).sort({ price: 1 });
    return data.map(DTO);
  },

  getOne: async (id) => {
    const tariff = await Tariff.findOne({ _id: id, isDeleted: false });
    if (!tariff) throw new Error("tariff.notFound");
    return DTO(tariff);
  },

  update: async (id, body) => {
    const tariff = await Tariff.findOne({ _id: id, isDeleted: false });
    if (!tariff) throw new Error("tariff.notFound");

    if (body.price != null && Number(body.price) < 0) {
      throw new Error("tariff.invalidPrice");
    }
    if (body.trialDays != null && Number(body.trialDays) < 0) {
      throw new Error("tariff.invalidLimit");
    }
    for (const field of LIMIT_FIELDS) {
      if (body[field] != null && Number(body[field]) < -1) {
        throw new Error("tariff.invalidLimit");
      }
    }

    const fields = ["name", "price", "trialDays", "allowedPermissions", ...LIMIT_FIELDS];
    for (const field of fields) {
      if (body[field] !== undefined) tariff[field] = body[field];
    }

    await tariff.save();
    return DTO(tariff);
  },

  remove: async (id) => {
    const tariff = await Tariff.findOne({ _id: id, isDeleted: false });
    if (!tariff) throw new Error("tariff.notFound");

    tariff.isDeleted = true;
    tariff.deletedAt = getNow();
    await tariff.save();

    return true;
  },
};
