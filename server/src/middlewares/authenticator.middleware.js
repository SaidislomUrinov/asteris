const { isValidObjectId } = require("mongoose");
const envConfig = require("../configs/env.config");
const keyConfig = require("../configs/key.config");
const Admin = require("../models/Admin");
const Client = require("../models/Client");
const Staff = require("../models/Staff");
const Group = require("../models/Group");
const Center = require("../models/Center");
const jwtUtil = require("../utils/jwt.util");
const redisUtil = require("../utils/redis.util");
const adminService = require("../services/admin.service");
const clientService = require("../services/client.service");
const staffService = require("../services/staff.service");
const { getNow } = require("../utils/date.util");

// Guruhga biriktirilish orqali cheklanadigan rollar → Group'dagi maydon nomi.
// O'qituvchi `teacher`, yordamchi o'qituvchi `assistant` bo'yicha bog'lanadi.
const GROUP_SCOPE_FIELD = { teacher: "teacher", assistant: "assistant" };

module.exports = {
  adminAuth: async (req, res, next) => {
    try {
      const header = req?.headers?.["x-admin-auth-token"];
      if (!header || !header?.startsWith("BerarerAdmin "))
        throw new Error("auth.failed");

      const access = header?.split(" ")[1];

      const payload = jwtUtil.verify(access, envConfig.ADMIN_JWT_SECRET);

      if (!payload || !payload?._id) throw new Error("auth.failed");

      // token boshqa sessiya bilan almashtirilgan yoki bekor qilingan bo'lsa rad etiladi
      const accessKey = keyConfig.adminAccess(payload._id);
      const cachedAccess = await redisUtil.get(accessKey);

      // Productionda faqat SO'NGGI login qilingan qurilma ishlaydi (bitta
      // qurilmadan sessiya). Development'da bu tekshiruv o'chiq — bir nechta
      // tab/curl bilan bir vaqtda ishlash uchun (envConfig.ENFORCE_SINGLE_DEVICE_SESSION).
      if (!cachedAccess || (envConfig.ENFORCE_SINGLE_DEVICE_SESSION && cachedAccess !== access))
        throw new Error("auth.failed");

      req.admin = {
        _id: payload?._id,
      };
      next();
    } catch (error) {
      next(error);
    }
  },
  fullAdminAuth: async (req, res, next) => {
    try {
      const adminId = req?.admin?._id;
      if (!adminId) throw new Error("auth.failed");

      const accessKey = keyConfig.adminAccess(adminId);
      const key = keyConfig.admin(adminId);
      const refreshKey = keyConfig.adminRefresh(adminId);
      const cached = await redisUtil.get(key);

      if (cached) {
        req.admin = cached;
      } else {
        const admin = await Admin.findOne({ _id: adminId });
        if (!admin) throw new Error("auth.failed");

        const data = adminService.DTO(admin);
        await redisUtil.set(key, data, envConfig.ADMIN_SESSION_TTL);

        req.admin = data;
      }

      // so'nggi faollikdan 24 soat sanog'ini qayta boshlash (sliding session)
      await Promise.all([
        redisUtil.touch(key, envConfig.ADMIN_SESSION_TTL),
        redisUtil.touch(accessKey, envConfig.ADMIN_SESSION_TTL),
        redisUtil.touch(refreshKey, envConfig.ADMIN_SESSION_TTL),
      ]);

      next();
    } catch (error) {
      next(error);
    }
  },
  // fullAdminAuth'dan keyin ishlatiladi — req.admin.role/permissions'ga tayanadi
  requirePermission: (permission) => (req, res, next) => {
    const { role, permissions } = req.admin || {};

    if (role === "owner" || permissions?.includes("all") || permissions?.includes(permission)) {
      return next();
    }

    next(new Error("auth.forbidden"));
  },

  // ---- Client Owner (client panel) ----
  clientAuth: async (req, res, next) => {
    try {
      const header = req?.headers?.["x-client-auth-token"];
      if (!header || !header?.startsWith("BerarerClient "))
        throw new Error("auth.failed");

      const access = header?.split(" ")[1];
      const payload = jwtUtil.verify(access, envConfig.CLIENT_JWT_SECRET);

      if (!payload || !payload?._id) throw new Error("auth.failed");

      const accessKey = keyConfig.clientAccess(payload._id);
      const cachedAccess = await redisUtil.get(accessKey);

      // Productionda faqat SO'NGGI login qilingan qurilma ishlaydi (bitta
      // qurilmadan sessiya). Development'da bu tekshiruv o'chiq — bir nechta
      // tab/curl bilan bir vaqtda ishlash uchun (envConfig.ENFORCE_SINGLE_DEVICE_SESSION).
      if (!cachedAccess || (envConfig.ENFORCE_SINGLE_DEVICE_SESSION && cachedAccess !== access))
        throw new Error("auth.failed");

      req.client = { _id: payload?._id };
      next();
    } catch (error) {
      next(error);
    }
  },
  fullClientAuth: async (req, res, next) => {
    try {
      const clientId = req?.client?._id;
      if (!clientId) throw new Error("auth.failed");

      const accessKey = keyConfig.clientAccess(clientId);
      const key = keyConfig.client(clientId);
      const refreshKey = keyConfig.clientRefresh(clientId);
      const cached = await redisUtil.get(key);

      if (cached) {
        req.client = cached;
      } else {
        const client = await Client.findOne({ _id: clientId, isDeleted: false });
        if (!client) throw new Error("auth.failed");
        if (client.blocked) throw new Error("client.blocked");

        const data = clientService.DTO(client);
        await redisUtil.set(key, data, envConfig.CLIENT_SESSION_TTL);

        req.client = data;
      }

      await Promise.all([
        redisUtil.touch(key, envConfig.CLIENT_SESSION_TTL),
        redisUtil.touch(accessKey, envConfig.CLIENT_SESSION_TTL),
        redisUtil.touch(refreshKey, envConfig.CLIENT_SESSION_TTL),
      ]);

      next();
    } catch (error) {
      next(error);
    }
  },

  // ---- Staff (Center Manager / Reception / Teacher) ----
  staffAuth: async (req, res, next) => {
    try {
      const header = req?.headers?.["x-staff-auth-token"];
      if (!header || !header?.startsWith("BerarerStaff "))
        throw new Error("auth.failed");

      const access = header?.split(" ")[1];
      const payload = jwtUtil.verify(access, envConfig.STAFF_JWT_SECRET);

      if (!payload || !payload?._id) throw new Error("auth.failed");

      const accessKey = keyConfig.staffAccess(payload._id);
      const cachedAccess = await redisUtil.get(accessKey);

      // Productionda faqat SO'NGGI login qilingan qurilma ishlaydi (bitta
      // qurilmadan sessiya). Development'da bu tekshiruv o'chiq — bir nechta
      // tab/curl bilan bir vaqtda ishlash uchun (envConfig.ENFORCE_SINGLE_DEVICE_SESSION).
      if (!cachedAccess || (envConfig.ENFORCE_SINGLE_DEVICE_SESSION && cachedAccess !== access))
        throw new Error("auth.failed");

      req.staff = { _id: payload?._id };
      next();
    } catch (error) {
      next(error);
    }
  },
  fullStaffAuth: async (req, res, next) => {
    try {
      const staffId = req?.staff?._id;
      if (!staffId) throw new Error("auth.failed");

      const accessKey = keyConfig.staffAccess(staffId);
      const key = keyConfig.staff(staffId);
      const refreshKey = keyConfig.staffRefresh(staffId);
      const cached = await redisUtil.get(key);

      if (cached) {
        req.staff = cached;
      } else {
        const staff = await Staff.findOne({ _id: staffId, isDeleted: false });
        if (!staff) throw new Error("auth.failed");
        if (staff.blocked) throw new Error("staff.blocked");

        const data = staffService.DTO(staff);
        await redisUtil.set(key, data, envConfig.STAFF_SESSION_TTL);

        req.staff = data;
      }

      // Tarif pasayganda markaz bloklanadi (API_CONTRACT.md §7.1.2) —
      // o'sha markazning hodimlari platformaga KIRA OLMAYDI. Tekshiruv
      // shu yerda: Redis'dagi staff sessiyasi keshlangan bo'lsa ham
      // markaz holati JONLI o'qiladi, aks holda bloklangan filial hodimi
      // sessiyasi tugaguncha ishlab yuraverardi. `select("status")` —
      // yengil so'rov, faqat bitta maydon.
      const staffCenter = await Center.findById(req.staff.center).select("status");
      if (staffCenter?.status === "blocked") throw new Error("center.blocked");

      await Promise.all([
        redisUtil.touch(key, envConfig.STAFF_SESSION_TTL),
        redisUtil.touch(accessKey, envConfig.STAFF_SESSION_TTL),
        redisUtil.touch(refreshKey, envConfig.STAFF_SESSION_TTL),
      ]);

      next();
    } catch (error) {
      next(error);
    }
  },
  // fullStaffAuth'dan keyin ishlatiladi — req.staff.role/permissions'ga tayanadi
  requireStaffPermission: (permission) => (req, res, next) => {
    const { role, permissions } = req.staff || {};

    // To'liq huquq endi ROL emas, RUXSAT orqali: `permissions: ["all"]`.
    // (Eski "manager" roli olib tashlandi — migratsiyada ular `reception`
    // + `["all"]` ga o'tkazilgan.)
    if (permissions?.includes("all") || permissions?.includes(permission)) {
      return next();
    }

    next(new Error("auth.forbidden"));
  },

  // ---- Tenant (Client Owner YOKI Staff) ----
  // Bitta endpoint ikkala rol guruhiga ham xizmat qiladi: qaysi header kelganiga
  // qarab mos auth zanjiri ishlaydi. Staff bo'lsa req.client = { _id: staff.client }
  // qilib qo'yiladi — mavjud controller/service zanjiri (clientId birinchi argument)
  // o'zgarishsiz ishlayveradi, tenant isolation esa staff.client orqali saqlanadi.
  tenantAuth: async (req, res, next) => {
    const mw = module.exports;

    if (req?.headers?.["x-client-auth-token"]) {
      return mw.clientAuth(req, res, (err) => {
        if (err) return next(err);
        mw.fullClientAuth(req, res, next);
      });
    }

    return mw.staffAuth(req, res, (err) => {
      if (err) return next(err);
      mw.fullStaffAuth(req, res, async (err2) => {
        if (err2) return next(err2);
        try {
          // Staff'ning egasi (Client) bloklangan/o'chirilgan bo'lsa kirish yopiladi
          const client = await Client.findOne({
            _id: req.staff.client,
            isDeleted: false,
          }).select("blocked");
          if (!client) throw new Error("auth.failed");
          if (client.blocked) throw new Error("client.blocked");

          req.client = { _id: req.staff.client };

          // Staff faqat o'z markazi doirasida ishlaydi — center filtri/tanlovi
          // majburan o'z markaziga almashtiriladi (boshqa markaz datasiga
          // o'tib bo'lmaydi).
          //
          // DIQQAT (Express 5): `req.query` — prototipdagi GETTER, u har
          // murojaatda query-stringni qaytadan parse qilib YANGI obyekt
          // qaytaradi. Shu sababli `req.query.center = ...` bir martalik
          // vaqtinchalik obyektni o'zgartiradi va darhol yo'qoladi — ya'ni
          // hech qanday ta'sir qilmaydi va har bir Staff butun tenant
          // ma'lumotini olib qolardi. Yagona ishonchli yo'l — `req` ustiga
          // o'ziga xos (own) `query` xossasini qo'yib, prototip getterini
          // shadow qilish. Shundan keyin barcha controller/service'lar
          // (ular allaqachon `req.query.center` ni o'qiydi) o'zgarishsiz
          // majburiy filialni ko'radi.
          const staffCenter = String(req.staff.center);
          Object.defineProperty(req, "query", {
            value: { ...req.query, center: staffCenter },
            writable: true,
            configurable: true,
            enumerable: true,
          });

          // `req.body` oddiy obyekt — unga yozish Express 5'da ham ishlaydi.
          // Yaratish/tahrirlashda boshqa filial ko'rsatilsa ham o'zinikiga
          // almashtiriladi (modullar `centerId` yoki `center` nomini ishlatadi).
          if (req.body && typeof req.body === "object") {
            if ("centerId" in req.body) req.body.centerId = staffCenter;
            if ("center" in req.body) req.body.center = staffCenter;
          }

          req.centerScope = staffCenter;

          next();
        } catch (error) {
          next(error);
        }
      });
    });
  },
  // tenantAuth'dan keyin, `:id` li route'lar uchun: Staff boshqa filialning
  // yozuviga ID orqali murojaat qila olmasligini ta'minlaydi. Xizmatlar
  // (getOne/update/remove) faqat `client` bo'yicha filtrlaydi — bu tenant
  // izolyatsiyasini beradi, lekin filial darajasidagi cheklovni EMAS.
  // Owner uchun no-op (u barcha filiallarni ko'radi).
  requireCenterMatch: (Model) => async (req, res, next) => {
    if (!req.staff) return next();
    try {
      const id = req.params.id;
      // `/export`, `/lookup`, `/summary` kabi literal yo'llar ham shu
      // naqshga tushadi — ular ObjectId emas, ularni tegishli route hal
      // qiladi, biz aralashmaymiz.
      if (!id || !isValidObjectId(id)) return next();

      const doc = await Model.findOne({ _id: id, client: req.client._id }).select("center");
      // Topilmasa — xizmatning o'z "notFound" xatosiga qo'yib beramiz, shunda
      // "mavjud emas" va "boshqa filialniki" javoblari aralashib ketmaydi.
      if (!doc) return next();
      if (String(doc.center) !== String(req.staff.center)) {
        throw new Error("auth.forbidden");
      }
      next();
    } catch (error) {
      next(error);
    }
  },

  // O'QITUVCHI va YORDAMCHI O'QITUVCHI uchun BUTUNLAY yopiq amallar.
  //
  // Bu ruxsat tekshiruvining TAKRORI emas, undan kuchliroq qatlam: guruh
  // yaratish/tahrirlash/o'chirish va o'quvchini guruhdan chiqarish —
  // Resepshin va Boshliqning ishi. Ruxsat ro'yxati (staffPermission.util.js)
  // ham bu ruxsatlarni bu rollarga bermaydi, lekin tarif/ruxsat sozlamalari
  // kelajakda o'zgarsa ham bu amallar ochilib ketmasligi kerak — shuning
  // uchun ROL bo'yicha qat'iy taqiq qo'yilgan.
  blockTeachingRoles: (req, res, next) =>
    GROUP_SCOPE_FIELD[req.staff?.role] ? next(new Error("auth.forbidden")) : next(),

  // tenantAuth'dan keyin: O'QITUVCHI va YORDAMCHI O'QITUVCHI faqat O'ZIGA
  // biriktirilgan guruhlar doirasida ishlaydi. Bu permission emas, SCOPE —
  // `group:view` ruxsati bo'lsa ham boshqa o'qituvchining guruhi ko'rinmaydi.
  //
  // Filial izolyatsiyasi bilan bir xil naqsh (Express 5: `req.query` —
  // getter, unga to'g'ridan-to'g'ri yozib bo'lmaydi, `defineProperty` kerak).
  teacherScope: (req, res, next) => {
    const field = GROUP_SCOPE_FIELD[req.staff?.role];
    if (!field) return next();

    const staffId = String(req.staff._id);
    Object.defineProperty(req, "query", {
      value: { ...req.query, [field]: staffId },
      writable: true,
      configurable: true,
      enumerable: true,
    });
    req.teacherScope = staffId;
    req.groupScopeField = field;
    next();
  },

  // `:groupId` (yoki boshqa param) bo'yicha guruh AYNAN shu hodimniki
  // ekanini tekshiradi. `teacherScope` ro'yxatlarni cheklaydi, bu esa
  // ID orqali to'g'ridan-to'g'ri murojaatni yopadi.
  requireTeacherGroup: (param = "groupId") => async (req, res, next) => {
    const field = GROUP_SCOPE_FIELD[req.staff?.role];
    if (!field) return next();
    try {
      const id = req.params[param];
      if (!id || !isValidObjectId(id)) return next();
      const group = await Group.findOne({
        _id: id,
        client: req.client._id,
        isDeleted: false,
      }).select("teacher assistant");
      if (!group) return next();
      if (String(group[field] || "") !== String(req.staff._id)) {
        throw new Error("auth.forbidden");
      }
      next();
    } catch (error) {
      next(error);
    }
  },

  // tenantAuth'dan keyin: faqat Client Owner o'tadi (staff uchun yopiq amallar)
  requireOwner: (req, res, next) => {
    if (req.staff) return next(new Error("auth.forbidden"));
    next();
  },
  // tenantAuth'dan keyin ishlatiladi. Owner uchun cheklov yo'q (tarif cheklovi
  // subscription darajasida), staff uchun rol/permission tekshiriladi.
  requireTenantPermission: (permission) => (req, res, next) => {
    if (!req.staff) return next(); // Client Owner

    const { role, permissions } = req.staff;
    // To'liq huquq endi ROL emas, RUXSAT orqali: `permissions: ["all"]`.
    // (Eski "manager" roli olib tashlandi — migratsiyada ular `reception`
    // + `["all"]` ga o'tkazilgan.)
    if (permissions?.includes("all") || permissions?.includes(permission)) {
      return next();
    }

    next(new Error("auth.forbidden"));
  },

  // tenantAuth'dan keyin ishlatiladi — tarif orqali ochilgan feature-flag
  // (masalan Excel export) mavjud emasligini tekshiradi. Har doim bazadan
  // yangi tarif holatini o'qiydi (client.service.js "hasPermission").
  requireTariffFeature: (permission) => async (req, res, next) => {
    try {
      const allowed = await clientService.hasPermission(req.client._id, permission);
      if (!allowed) throw new Error("tariff.featureNotAvailable");
      next();
    } catch (error) {
      next(error);
    }
  },

  // CLAUDE.md "Subscription hayotiy sikli": muddat tugasa markaz Read-Only'ga
  // o'tadi — ko'rish (GET, moliyaviy hisobotlar jumladan) ishlayveradi, lekin
  // create/update/delete bloklanadi. Obuna Client darajasida (Center darajasida
  // emas) bo'lgani uchun bitta clientning BARCHA filiallari birdek cheklanadi.
  // GET'lar tekshirilmasdan o'tkaziladi — shu middleware faqat mutatsion
  // (POST/PATCH/PUT/DELETE) so'rovlarni to'xtatadi.
  requireActiveSubscription: async (req, res, next) => {
    if (req.method === "GET") return next();
    try {
      const client = await Client.findById(req.client._id)
        .select("subscription")
        .populate({ path: "subscription", select: "status endDate" });
      const sub = client?.subscription;
      const active = !!sub && sub.status === "active" && sub.endDate > getNow();
      if (!active) throw new Error("client.subscriptionExpired");
      next();
    } catch (error) {
      next(error);
    }
  },
};
