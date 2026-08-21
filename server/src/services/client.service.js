const Client = require("../models/Client");
const Lead = require("../models/Lead");
const Tariff = require("../models/Tariff");
const Subscription = require("../models/Subscription");
const Center = require("../models/Center");
const Group = require("../models/Group");
const Staff = require("../models/Staff");
const Student = require("../models/Student");
const { getHash, compareHash } = require("../utils/hash.util");
const { getNow, addMonths } = require("../utils/date.util");
const envConfig = require("../configs/env.config");
const keyConfig = require("../configs/key.config");
const jwtUtil = require("../utils/jwt.util");
const redisUtil = require("../utils/redis.util");

const issueTokens = (clientId) => {
  const access = jwtUtil.sign(
    { _id: clientId },
    envConfig.CLIENT_JWT_SECRET,
    envConfig.CLIENT_ACCESS_EXPIRES_IN,
  );
  const refresh = jwtUtil.sign(
    { _id: clientId },
    envConfig.CLIENT_REFRESH_JWT_SECRET,
    "30d", // absolyut chegara, haqiqiy amal qilish muddati Redis TTL orqali boshqariladi
  );

  return { access, refresh };
};

const PAGE_SIZE = 50;
// Boshlanish sanasi kiritilsa, tugash sanasi default "keyingi oy, o'sha kun"
// bo'lib avtomatik hisoblanadi — admin buni keyin qo'lda o'zgartira oladi.
const defaultEndDate = (start) => addMonths(start, 1);

// Nom va tarif imkoniyatlari (limit/permissions) jonli — Tariff o'zgarsa
// mijoz obunasida ham darhol yangilanadi. Faqat `price` (kelishilgan pul
// summasi) moliyaviy yozuv sifatida muzlatilgan holicha qoladi (Subscription.price).
const liveTariffSnapshot = (sub) => {
  const tariffDoc = sub.tariff?._id ? sub.tariff : null;
  if (!tariffDoc) return sub.tariffSnapshot;
  return {
    ...sub.tariffSnapshot,
    name: tariffDoc.name,
    studentLimit: tariffDoc.studentLimit,
    centerLimit: tariffDoc.centerLimit,
    teacherLimit: tariffDoc.teacherLimit,
    receptionLimit: tariffDoc.receptionLimit,
    allowedPermissions: tariffDoc.allowedPermissions,
  };
};

const subscriptionDTO = (sub) => {
  if (!sub) return null;
  return {
    _id: sub._id,
    tariff: sub.tariff?._id ? sub.tariff._id : sub.tariff,
    tariffSnapshot: liveTariffSnapshot(sub),
    price: sub.price,
    startDate: sub.startDate,
    endDate: sub.endDate,
    startDateText: sub.startDateText,
    endDateText: sub.endDateText,
    status: sub.status,
    date: sub.date,
  };
};

const DTO = (data) => ({
  _id: data?._id,
  clientId: data?.clientId,
  name: data?.name,
  phone: data?.phone,
  lead: data?.lead,
  blocked: data?.blocked,
  subscription: subscriptionDTO(data?.subscription),
  trialUsed: data?.trialUsed,
  date: data?.date,
  lastUpdate: data?.lastUpdate,
});

const populateSubscription = (query) =>
  query.populate({ path: "subscription", populate: { path: "tariff" } });

const snapshotTariff = (tariff) => ({
  name: tariff.name,
  price: tariff.price,
  studentLimit: tariff.studentLimit,
  centerLimit: tariff.centerLimit,
  teacherLimit: tariff.teacherLimit,
  receptionLimit: tariff.receptionLimit,
  allowedPermissions: tariff.allowedPermissions,
});

module.exports = {
  DTO,
  snapshotTariff,

  create: async (body) => {
    const { name, phone, password } = body;
    if (!name || !phone || !password) throw new Error("client.fillTheRows");

    const trimmedPhone = phone.trim();
    const exists = await Client.findOne({ phone: trimmedPhone, isDeleted: false });
    if (exists) throw new Error("client.phoneTaken");

    // Shu raqamga mos, hali hech qaysi clientga bog'lanmagan eng so'nggi leadni topib biriktiramiz
    const matchedLead = await Lead.findOne({ phone: trimmedPhone, client: null }).sort({
      createdAt: -1,
    });

    const client = await Client.create({
      name: name.trim(),
      phone: trimmedPhone,
      password: await getHash(password.trim()),
      lead: matchedLead?._id || null,
    });

    if (matchedLead) {
      matchedLead.client = client._id;
      await matchedLead.save();
    }

    return { ...DTO(client), plainPassword: password.trim() };
  },

  list: async ({ page = 1, search = "" }) => {
    const trimmedSearch = search?.trim();
    const baseFilter = { isDeleted: false };

    if (trimmedSearch) {
      const regex = new RegExp(trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const data = await populateSubscription(
        Client.find({ ...baseFilter, $or: [{ name: regex }, { phone: regex }] }).sort({
          createdAt: -1,
        }),
      );

      return {
        data: data.map(DTO),
        meta: { page: 1, limit: data.length, total: data.length, totalPages: 1 },
      };
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const skip = (pageNum - 1) * PAGE_SIZE;

    const [data, total] = await Promise.all([
      populateSubscription(
        Client.find(baseFilter).sort({ createdAt: -1 }).skip(skip).limit(PAGE_SIZE),
      ),
      Client.countDocuments(baseFilter),
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

  getOne: async (id) => {
    const client = await populateSubscription(
      Client.findOne({ _id: id, isDeleted: false }),
    );
    if (!client) throw new Error("client.notFound");
    return DTO(client);
  },

  // Tarif orqali ochilgan feature-flag'ni tekshiradi (masalan "excel.export")
  // — req.client owner uchun to'liq DTO, staff uchun faqat {_id} bo'lishi
  // mumkinligi sabab har doim bazadan yangi holatni o'qiydi (jonli tarif
  // o'zgarishi darhol amal qiladi, keshlangan sessiyaga qaramaydi).
  hasPermission: async (clientId, permission) => {
    const client = await populateSubscription(
      Client.findOne({ _id: clientId, isDeleted: false }),
    );
    if (!client) return false;
    const allowed = liveTariffSnapshot(client.subscription)?.allowedPermissions || [];
    return allowed.includes(permission);
  },

  // Hodim (Staff) payloadiga qo'shiladigan tarif feature flaglari — hodim
  // panelida qaysi premium bo'limlar ko'rinishini shu ro'yxat hal qiladi
  // (masalan "QR davomat"). `hasPermission` bilan bir xil manba, faqat
  // bitta flagni emas, butun ro'yxatni qaytaradi. Narx/limit kabi obuna
  // tafsilotlari ATAYIN chiqarilmaydi — hodimga faqat shu kerak.
  getTariffFeatures: async (clientId) => {
    const client = await populateSubscription(Client.findOne({ _id: clientId, isDeleted: false }));
    if (!client?.subscription) return [];
    return liveTariffSnapshot(client.subscription)?.allowedPermissions || [];
  },

  // Staff panel (Reception/Manager/Teacher) — obuna tugagan/yo'q bo'lsa
  // "Markaz direktoriga xabar bering" modalini ko'rsatish uchun. Har doim
  // bazadan yangi holatni o'qiydi (Redis'dagi staff sessiyasi bilan
  // eskirmasligi uchun) — `requireActiveSubscription` bilan bir xil mantiq.
  getSubscriptionStatus: async (clientId) => {
    const client = await Client.findOne({ _id: clientId, isDeleted: false })
      .select("subscription")
      .populate({ path: "subscription", select: "status endDate" });
    const sub = client?.subscription;
    const active = !!sub && sub.status === "active" && sub.endDate > getNow();
    return { active };
  },

  update: async (id, body) => {
    const client = await Client.findOne({ _id: id, isDeleted: false });
    if (!client) throw new Error("client.notFound");

    if (body.phone && body.phone.trim() !== client.phone) {
      const trimmedPhone = body.phone.trim();
      const exists = await Client.findOne({
        phone: trimmedPhone,
        isDeleted: false,
        _id: { $ne: id },
      });
      if (exists) throw new Error("client.phoneTaken");
      client.phone = trimmedPhone;
    }

    if (body.name) client.name = body.name.trim();
    if (body.password) client.password = await getHash(body.password.trim());

    await client.save();
    await client.populate({ path: "subscription", populate: { path: "tariff" } });
    return DTO(client);
  },

  remove: async (id) => {
    const client = await Client.findOne({ _id: id, isDeleted: false });
    if (!client) throw new Error("client.notFound");

    client.isDeleted = true;
    client.deletedAt = getNow();
    await client.save();

    return true;
  },

  setBlocked: async (id, blocked) => {
    const client = await Client.findOne({ _id: id, isDeleted: false });
    if (!client) throw new Error("client.notFound");

    client.blocked = blocked;
    await client.save();
    await client.populate({ path: "subscription", populate: { path: "tariff" } });
    return DTO(client);
  },

  subscribe: async (id, body, admin) => {
    const { tariffId, startDate, endDate, price } = body;
    if (!tariffId) throw new Error("client.fillTheRows");
    if (price !== undefined && price < 0) throw new Error("client.invalidPrice");

    const client = await Client.findOne({ _id: id, isDeleted: false });
    if (!client) throw new Error("client.notFound");
    if (client.subscription) throw new Error("client.alreadySubscribed");

    const tariff = await Tariff.findOne({ _id: tariffId, isDeleted: false });
    if (!tariff) throw new Error("tariff.notFound");

    const start = startDate || getNow();
    const end = endDate || defaultEndDate(start);
    if (end <= start) throw new Error("client.invalidEndDate");

    const sub = await Subscription.create({
      client: client._id,
      tariff: tariff._id,
      tariffSnapshot: snapshotTariff(tariff),
      price: price !== undefined ? price : tariff.price,
      startDate: start,
      endDate: end,
      status: "active",
      createdBy: admin._id,
    });

    client.subscription = sub._id;
    await client.save();
    await client.populate({ path: "subscription", populate: { path: "tariff" } });
    return DTO(client);
  },

  unsubscribe: async (id) => {
    const client = await Client.findOne({ _id: id, isDeleted: false });
    if (!client) throw new Error("client.notFound");
    if (!client.subscription) throw new Error("client.noActiveSubscription");

    await Subscription.updateOne(
      { _id: client.subscription },
      { status: "cancelled" },
    );
    client.subscription = null;
    await client.save();
    return DTO(client);
  },

  changeTariff: async (id, body, admin) => {
    const { tariffId, mode, startDate, endDate, price } = body;
    if (!tariffId || !["new", "keep"].includes(mode)) {
      throw new Error("client.invalidMode");
    }
    if (price !== undefined && price < 0) throw new Error("client.invalidPrice");

    const client = await Client.findOne({ _id: id, isDeleted: false });
    if (!client) throw new Error("client.notFound");
    if (!client.subscription) throw new Error("client.noActiveSubscription");

    const current = await Subscription.findById(client.subscription);
    if (!current) throw new Error("client.noActiveSubscription");

    const tariff = await Tariff.findOne({ _id: tariffId, isDeleted: false });
    if (!tariff) throw new Error("tariff.notFound");

    const start = mode === "keep" ? current.startDate : startDate || getNow();
    const end =
      mode === "keep" ? current.endDate : endDate || defaultEndDate(start);
    if (end <= start) throw new Error("client.invalidEndDate");

    const newSub = await Subscription.create({
      client: client._id,
      tariff: tariff._id,
      tariffSnapshot: snapshotTariff(tariff),
      price: price !== undefined ? price : tariff.price,
      startDate: start,
      endDate: end,
      status: "active",
      createdBy: admin._id,
    });

    current.status = "changed";
    await current.save();

    client.subscription = newSub._id;
    await client.save();
    await client.populate({ path: "subscription", populate: { path: "tariff" } });
    return DTO(client);
  },

  // Tarif pasayganda "ortiqcha filial" holatini aniqlaydi (API_CONTRACT.md
  // §7.1.1). Frontendda majburiy (non-dismissible) modal shu javobga
  // tayanadi, shuning uchun obuna muammoli bo'lganda ham ishlashi kerak —
  // route'da `requireActiveSubscription` YO'Q.
  getCenterOverflow: async (clientId) => {
    const client = await populateSubscription(
      Client.findOne({ _id: clientId, isDeleted: false }),
    );
    if (!client) throw new Error("client.notFound");

    const limit = client.subscription
      ? liveTariffSnapshot(client.subscription)?.centerLimit ?? -1
      : -1;

    const centers = await Center.find({ client: clientId, isDeleted: false }).sort({
      createdAt: 1,
    });

    // Qaror qabul qilish uchun har markazning "og'irligi" ko'rsatiladi —
    // foydalanuvchi eng katta filialni bexosdan bloklab qo'ymasligi uchun.
    const centerIds = centers.map((c) => c._id);
    const [groups, staffs, students] = await Promise.all([
      Group.find({ client: clientId, isDeleted: false, center: { $in: centerIds } }, { center: 1 }),
      Staff.find({ client: clientId, isDeleted: false, center: { $in: centerIds } }, { center: 1 }),
      Student.find(
        { "groups.client": clientId, isDeleted: false },
        { groups: 1 },
      ),
    ]);

    const groupCount = {};
    for (const g of groups) groupCount[String(g.center)] = (groupCount[String(g.center)] || 0) + 1;

    const staffCount = {};
    for (const s of staffs) staffCount[String(s.center)] = (staffCount[String(s.center)] || 0) + 1;

    const studentSets = {};
    for (const student of students) {
      for (const entry of student.groups || []) {
        if (String(entry.client) !== String(clientId)) continue;
        if (entry.status !== "active") continue;
        const key = String(entry.center);
        if (!studentSets[key]) studentSets[key] = new Set();
        studentSets[key].add(String(student._id));
      }
    }

    const activeCount = centers.filter((c) => c.status === "active").length;
    const overflow = limit === -1 ? 0 : Math.max(0, activeCount - limit);

    return {
      needsAction: overflow > 0,
      limit,
      activeCount,
      overflow,
      centers: centers.map((c) => ({
        _id: c._id,
        name: c.name,
        logo: c.logo,
        status: c.status,
        createdAt: c.createdAt,
        students: studentSets[String(c._id)] ? studentSets[String(c._id)].size : 0,
        groups: groupCount[String(c._id)] || 0,
        staff: staffCount[String(c._id)] || 0,
      })),
    };
  },

  // ---- Client Owner auth (client panel) ----
  signIn: async (body) => {
    const { phone, password } = body;
    if (!phone || !password) throw new Error("auth.fillTheRows");

    const client = await Client.findOne({ phone: phone.trim(), isDeleted: false });
    if (!client) throw new Error("auth.notFound");
    if (client.blocked) throw new Error("client.blocked");

    const checkPass = await compareHash(password?.trim(), client.password);
    if (!checkPass) throw new Error("auth.notFound");

    await client.populate({ path: "subscription", populate: { path: "tariff" } });
    const data = DTO(client);
    const { access, refresh } = issueTokens(client._id);

    client.access = access;
    const key = keyConfig.client(client._id);
    const accessKey = keyConfig.clientAccess(client._id);
    const refreshKey = keyConfig.clientRefresh(client._id);
    await Promise.all([
      client.save(),
      redisUtil.set(key, data, envConfig.CLIENT_SESSION_TTL),
      redisUtil.set(accessKey, access, envConfig.CLIENT_SESSION_TTL),
      redisUtil.set(refreshKey, refresh, envConfig.CLIENT_SESSION_TTL),
    ]);

    return { data, access, refresh };
  },

  refreshToken: async (refreshToken) => {
    if (!refreshToken) throw new Error("auth.failed");

    let payload;
    try {
      payload = jwtUtil.verify(refreshToken, envConfig.CLIENT_REFRESH_JWT_SECRET);
    } catch {
      throw new Error("auth.failed");
    }

    const clientId = payload?._id;
    if (!clientId) throw new Error("auth.failed");

    const refreshKey = keyConfig.clientRefresh(clientId);
    const cachedRefresh = await redisUtil.get(refreshKey);
    if (!cachedRefresh || cachedRefresh !== refreshToken) throw new Error("auth.failed");

    const client = await Client.findOne({ _id: clientId, isDeleted: false });
    if (!client) throw new Error("auth.failed");
    if (client.blocked) throw new Error("client.blocked");

    await client.populate({ path: "subscription", populate: { path: "tariff" } });
    const data = DTO(client);
    const { access, refresh } = issueTokens(clientId);

    client.access = access;
    const key = keyConfig.client(clientId);
    const accessKey = keyConfig.clientAccess(clientId);
    await Promise.all([
      client.save(),
      redisUtil.set(key, data, envConfig.CLIENT_SESSION_TTL),
      redisUtil.set(accessKey, access, envConfig.CLIENT_SESSION_TTL),
      redisUtil.set(refreshKey, refresh, envConfig.CLIENT_SESSION_TTL),
    ]);

    return { data, access, refresh };
  },

  signOutSession: async (client) => {
    const key = keyConfig.client(client._id);
    const accessKey = keyConfig.clientAccess(client._id);
    const refreshKey = keyConfig.clientRefresh(client._id);
    await Promise.all([
      Client.updateOne({ _id: client._id }, { $set: { access: "" } }),
      redisUtil.del(key),
      redisUtil.del(accessKey),
      redisUtil.del(refreshKey),
    ]);

    return true;
  },
};
