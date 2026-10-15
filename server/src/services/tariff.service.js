const Tariff = require("../models/Tariff");
const { getNow } = require("../utils/date.util");
const clientService = require("./client.service");
const SystemSetting = require("../models/SystemSetting");
const systemSettingService = require("./systemSetting.service");
const { normalizeDiscounts, discountsOf } = require("../utils/subscriptionPricing.util");

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
  isPublic: data?.isPublic,
  highlighted: data?.highlighted,
  tagline: data?.tagline,
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
    const { name, price, allowedPermissions, trialDays, isPublic, highlighted, tagline } = body;

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
      isPublic: !!isPublic,
      highlighted: !!highlighted,
      tagline: tagline?.trim() || "",
    });

    return DTO(tariff);
  },

  list: async () => {
    const data = await Tariff.find({ isDeleted: false }).sort({ price: 1 });
    return data.map(DTO);
  },

  // wenet.uz narx sahifasi uchun — autentifikatsiyasiz. Faqat `isPublic`
  // yoqilgan tariflar va faqat ommaga ko'rsatiladigan maydonlar chiqadi
  // (ichki `allowedPermissions` ro'yxati ham beriladi, chunki sahifa
  // imkoniyatlar jadvalini shundan quradi).
  // GET /tariffs/discounts — obuna muddati chegirmalari (barcha tariflar uchun
  // umumiy, docs/API_CONTRACT_tariff_discounts.md). Keshdan (systemSetting).
  getDiscounts: async () => ({ items: discountsOf(await systemSettingService.getRaw()) }),

  // PUT /tariffs/discounts — Platform Admin (`tariff:update`).
  updateDiscounts: async (body, adminId) => {
    const items = normalizeDiscounts(body?.items);
    await SystemSetting.findOneAndUpdate(
      { key: "global" },
      {
        $set: {
          "subscription.durationDiscounts": items,
          updatedAt: getNow(),
          ...(adminId ? { updatedBy: adminId } : {}),
        },
      },
      { upsert: true },
    );
    await systemSettingService.invalidate();
    return { items };
  },

  publicList: async () => {
    const data = await Tariff.find({ isDeleted: false, isPublic: true }).sort({
      price: 1,
    });

    return data.map((t) => ({
      _id: t._id,
      name: t.name,
      tagline: t.tagline || "",
      price: t.price,
      trialDays: t.trialDays,
      studentLimit: t.studentLimit,
      centerLimit: t.centerLimit,
      teacherLimit: t.teacherLimit,
      receptionLimit: t.receptionLimit,
      allowedPermissions: t.allowedPermissions || [],
      highlighted: !!t.highlighted,
    }));
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

    const fields = [
      "name",
      "price",
      "trialDays",
      "allowedPermissions",
      "isPublic",
      "highlighted",
      "tagline",
      ...LIMIT_FIELDS,
    ];
    for (const field of fields) {
      if (body[field] !== undefined) tariff[field] = body[field];
    }

    // Obunaga ta'sir qiladigan maydonlar — narx/sinov/ommaviylik joriy
    // obunalarni o'zgartirmaydi (narx obunada kelishilgan summa sifatida qoladi).
    const affectsSubscriptions = ["name", "allowedPermissions", ...LIMIT_FIELDS].some((f) =>
      tariff.isModified(f),
    );

    await tariff.save();
    if (affectsSubscriptions) await clientService.syncSubscriptionsWithTariff(tariff);
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
