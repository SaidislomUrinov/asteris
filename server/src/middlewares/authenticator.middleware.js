const { isValidObjectId } = require("mongoose");
const envConfig = require("../configs/env.config");
const keyConfig = require("../configs/key.config");
const Admin = require("../models/Admin");
const Client = require("../models/Client");
const Staff = require("../models/Staff");
const Group = require("../models/Group");
const Student = require("../models/Student");
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

// Sessiya kanali: Telegram WebApp orqali berilgan token payloadida `ch: "tg"`
// bor (client/staff.service `signInTelegram`), brauzer tokenida yo'q.
const authChannelOf = (payload) => (payload?.ch === "tg" ? "tg" : "web");

// ── Faol filial (API_CONTRACT_multi_center.md §2) ─────────────────────────
// Client ilovasi har so'rovda `x-center-id` yuboradi. Staff uchun — o'z
// filiallaridan biri bo'lishi shart, Owner uchun — o'z mijozining filiali.
const readCenterHeader = (req) => {
  const value = req?.headers?.["x-center-id"];
  return typeof value === "string" && isValidObjectId(value) ? value : null;
};

// Express 5: `req.query` — getter, faqat own-property bilan almashtiriladi
// (tenantAuth'dagi izohga qarang).
const forceQueryCenter = (req, centerId) => {
  Object.defineProperty(req, "query", {
    value: { ...req.query, center: centerId },
    writable: true,
    configurable: true,
    enumerable: true,
  });
};

// Owner header'ini tekshirish keshi — har so'rovda bazaga bormaslik uchun.
// Filial o'chirilsa 60 soniya ichida kesh eskiradi (o'chirilgan filial
// ma'lumotlari baribir `isDeleted` filtrlari bilan yopiq).
const OWNER_CENTER_CACHE = new Map();
const OWNER_CENTER_TTL = 60 * 1000;
const ownerCenterValid = async (clientId, centerId) => {
  const key = `${clientId}:${centerId}`;
  const hit = OWNER_CENTER_CACHE.get(key);
  if (hit && hit.at > Date.now() - OWNER_CENTER_TTL) return hit.ok;
  const ok = !!(await Center.exists({ _id: centerId, client: clientId, isDeleted: false }));
  if (OWNER_CENTER_CACHE.size > 5000) OWNER_CENTER_CACHE.clear();
  OWNER_CENTER_CACHE.set(key, { ok, at: Date.now() });
  return ok;
};

// Owner faol filiali: ro'yxat so'rovlari (`req.query.center`) shu filialga
// cheklanadi, `req.centerScope` qo'yiladi. `req.body` tegilmaydi — Owner
// filiallararo amallarni (o'quvchini boshqa filial guruhiga ko'chirish)
// bajara olishi kerak. Header yo'q bo'lsa eski xatti-harakat.
const applyOwnerCenter = async (req) => {
  const centerId = readCenterHeader(req);
  if (!centerId || !(await ownerCenterValid(String(req.client._id), centerId))) return;
  forceQueryCenter(req, centerId);
  req.centerScope = centerId;
  req.activeCenter = centerId;
};

// Staff faol filiali: header ruxsat etilgan (o'chirilmagan, bloklanmagan)
// filiallardan biri bo'lsa o'sha, aks holda asosiy, aks holda birinchisi.
const resolveStaffCenter = async (staff, wanted) => {
  const own = Staff.centersOf(staff);
  const rows = await Center.find({ _id: { $in: own }, isDeleted: false }).select("status").lean();
  const usable = own.filter((id) => rows.some((r) => String(r._id) === id && r.status !== "blocked"));
  if (!usable.length) {
    throw new Error(rows.length ? "center.blocked" : "auth.failed");
  }
  const primary = String(staff.center);
  const active = wanted && usable.includes(wanted) ? wanted : usable.includes(primary) ? primary : usable[0];
  return { active, usable, primary };
};

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

      // Kanal: Telegram WebApp tokeni (`ch: "tg"`) alohida Redis slot'ida
      // (API_CONTRACT_worker_webapp.md §1.1) — brauzer va WebApp bir-birini uzmaydi.
      const channel = authChannelOf(payload);
      const accessKey = keyConfig.accessFor("client", payload._id, channel);
      const cachedAccess = await redisUtil.get(accessKey);

      // Productionda faqat SO'NGGI login qilingan qurilma ishlaydi (bitta
      // qurilmadan sessiya) — kanal ICHIDA. Development'da bu tekshiruv o'chiq — bir nechta
      // tab/curl bilan bir vaqtda ishlash uchun (envConfig.ENFORCE_SINGLE_DEVICE_SESSION).
      if (!cachedAccess || (envConfig.ENFORCE_SINGLE_DEVICE_SESSION && cachedAccess !== access))
        throw new Error("auth.failed");

      req.client = { _id: payload?._id };
      req.authChannel = channel;
      next();
    } catch (error) {
      next(error);
    }
  },
  fullClientAuth: async (req, res, next) => {
    try {
      const clientId = req?.client?._id;
      if (!clientId) throw new Error("auth.failed");

      const accessKey = keyConfig.accessFor("client", clientId, req.authChannel);
      const key = keyConfig.client(clientId);
      const cached = await redisUtil.get(key);

      if (cached) {
        req.client = cached;
      } else {
        // Obuna+tarif populate shart — aks holda DTO'dagi `subscription`
        // bo'sh maydonlar bilan qaytib, owner'da barcha tarif imkoniyatlari
        // yo'qolardi (signIn'dagi bilan bir xil shakl). Kesh tarif
        // o'zgarganda tashlanadi (clientService.syncSubscriptionsWithTariff).
        const client = await Client.findOne({ _id: clientId, isDeleted: false }).populate({
          path: "subscription",
          populate: { path: "tariff" },
        });
        if (!client) throw new Error("auth.failed");
        if (client.blocked) throw new Error("client.blocked");

        const data = clientService.DTO(client);
        await redisUtil.set(key, data, envConfig.CLIENT_SESSION_TTL);

        req.client = data;
      }

      await Promise.all([
        redisUtil.touch(key, envConfig.CLIENT_SESSION_TTL),
        redisUtil.touch(accessKey, envConfig.CLIENT_SESSION_TTL),
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

      const channel = authChannelOf(payload);
      const accessKey = keyConfig.accessFor("staff", payload._id, channel);
      const cachedAccess = await redisUtil.get(accessKey);

      // Productionda faqat SO'NGGI login qilingan qurilma ishlaydi (bitta
      // qurilmadan sessiya) — kanal ICHIDA. Development'da bu tekshiruv o'chiq — bir nechta
      // tab/curl bilan bir vaqtda ishlash uchun (envConfig.ENFORCE_SINGLE_DEVICE_SESSION).
      if (!cachedAccess || (envConfig.ENFORCE_SINGLE_DEVICE_SESSION && cachedAccess !== access))
        throw new Error("auth.failed");

      req.staff = { _id: payload?._id };
      req.authChannel = channel;
      next();
    } catch (error) {
      next(error);
    }
  },
  fullStaffAuth: async (req, res, next) => {
    try {
      const staffId = req?.staff?._id;
      if (!staffId) throw new Error("auth.failed");

      const accessKey = keyConfig.accessFor("staff", staffId, req.authChannel);
      const key = keyConfig.staff(staffId);
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

      // Faol filial (API_CONTRACT_multi_center.md §2). Tarif pasayganda
      // markaz bloklanadi (API_CONTRACT.md §7.1.2) — bloklangan filialda
      // ishlab bo'lmaydi, hodimning BARCHA filiallari bloklangan bo'lsa
      // platformaga kira olmaydi. Holat har so'rovda JONLI o'qiladi (Redis
      // sessiya keshi eskirgan bo'lishi mumkin). `req.staff.center` — FAOL
      // filial: barcha mavjud filial tekshiruvlari o'zgarishsiz ishlaydi.
      const { active, usable, primary } = await resolveStaffCenter(req.staff, readCenterHeader(req));
      req.staff = { ...req.staff, center: active, primaryCenter: primary, centers: usable };
      req.activeCenter = active;

      await Promise.all([
        redisUtil.touch(key, envConfig.STAFF_SESSION_TTL),
        redisUtil.touch(accessKey, envConfig.STAFF_SESSION_TTL),
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
  // OTA-ONA (Telegram WebApp) — API_CONTRACT_parent.md §4.1. Admin/Client/
  // Staff'dan farqi: Redis sessiya YO'Q (token 30 kun, refresh yo'q). Tenant
  // tokenda emas — har endpoint topilgan a'zolik (`entry`) bo'yicha tekshiradi,
  // shuning uchun bu yerda faqat Parent hujjati yuklanadi (`req.parent`).
  parentAuth: async (req, res, next) => {
    try {
      const header = req?.headers?.["x-parent-auth-token"];
      if (!header || !header?.startsWith("BerarerParent ")) throw new Error("auth.failed");

      const access = header?.split(" ")[1];
      if (!envConfig.PARENT_JWT_SECRET) throw new Error("auth.failed");
      const payload = jwtUtil.verify(access, envConfig.PARENT_JWT_SECRET);
      if (!payload || !payload?._id || !isValidObjectId(payload._id)) throw new Error("auth.failed");

      const parent = await require("../models/Parent").findById(payload._id);
      // /unlink qilingan (hujjat o'chgan) yoki chat almashgan bo'lsa token yaroqsiz.
      if (!parent || String(parent.telegram?.chatId) !== String(payload.chatId)) throw new Error("auth.failed");

      req.parent = parent;
      next();
    } catch (error) {
      next(new Error("auth.failed"));
    }
  },

  // clientAuth+fullClientAuth'dan keyin (Owner-only route'lar, masalan /staffs):
  // faol filial bo'yicha ro'yxat cheklovi — tenantAuth owner tarmog'i bilan bir xil.
  ownerCenterScope: async (req, res, next) => {
    try {
      await applyOwnerCenter(req);
      next();
    } catch (error) {
      next(error);
    }
  },

  tenantAuth: async (req, res, next) => {
    const mw = module.exports;

    if (req?.headers?.["x-client-auth-token"]) {
      return mw.clientAuth(req, res, (err) => {
        if (err) return next(err);
        mw.fullClientAuth(req, res, async (err2) => {
          if (err2) return next(err2);
          try {
            await applyOwnerCenter(req);
            next();
          } catch (error) {
            next(error);
          }
        });
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
  // O'qituvchi/yordamchi bo'lsa guruhdagi maydon nomi ("teacher"/"assistant"), aks holda null.
  teachingScopeField: (req) => GROUP_SCOPE_FIELD[req.staff?.role] || null,

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
  // `:groupId` li route'lar uchun guruh doirasi (Owner uchun no-op):
  //  - har qanday hodim — guruh O'Z FILIALIDA bo'lishi shart (2026-10-02 QA:
  //    resepshin boshqa filial guruhiga davomat/baho/dam olish kuni yozib,
  //    jurnalini o'qiy olardi — avval faqat o'qituvchi tekshirilardi);
  //  - o'qituvchi/yordamchi — qo'shimcha ravishda guruh O'ZIGA biriktirilgan.
  requireTeacherGroup: (param = "groupId") => async (req, res, next) => {
    if (!req.staff) return next();
    const field = GROUP_SCOPE_FIELD[req.staff.role];
    try {
      const id = req.params[param];
      if (!id || !isValidObjectId(id)) return next();
      const group = await Group.findOne({
        _id: id,
        client: req.client._id,
        isDeleted: false,
      }).select("center teacher assistant");
      if (!group) return next();
      if (String(group.center) !== String(req.staff.center)) {
        throw new Error("auth.forbidden");
      }
      if (field && String(group[field] || "") !== String(req.staff._id)) {
        throw new Error("auth.forbidden");
      }
      next();
    } catch (error) {
      next(error);
    }
  },

  // `:centerId` li route'lar uchun: hodim faqat O'Z filiali (sozlamalar,
  // kalendar). Owner uchun no-op.
  requireOwnCenterParam: (param = "centerId") => (req, res, next) => {
    if (!req.staff) return next();
    const id = req.params[param];
    if (id && String(id) !== String(req.staff.center)) return next(new Error("auth.forbidden"));
    next();
  },

  // `:studentId` li route'lar uchun: hodim faqat o'z filialidagi a'zoligi
  // bor o'quvchini; o'qituvchi/yordamchi — faqat O'Z guruhidagi o'quvchini.
  // O'quvchi hujjati platforma bo'ylab umumiy (telefon bo'yicha yagona),
  // shuning uchun tekshiruv a'zolik (`groups[]`) darajasida.
  requireStudentScope: (param = "studentId") => async (req, res, next) => {
    if (!req.staff) return next();
    try {
      const id = req.params[param];
      if (!id || !isValidObjectId(id)) return next();
      const field = GROUP_SCOPE_FIELD[req.staff.role];
      const student = await Student.findOne({ _id: id }).select("groups.client groups.center groups.group");
      if (!student) return next();
      const mine = (student.groups || []).filter(
        (g) => String(g.client) === String(req.client._id) && String(g.center) === String(req.staff.center),
      );
      if (!mine.length) throw new Error("auth.forbidden");
      if (field) {
        const own = await Group.exists({
          _id: { $in: mine.map((g) => g.group) },
          client: req.client._id,
          [field]: req.staff._id,
        });
        if (!own) throw new Error("auth.forbidden");
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
        .populate({
          path: "subscription",
          select: "status endDate tariff tariffSnapshot.centerLimit",
          populate: { path: "tariff", select: "centerLimit isDeleted" },
        });
      const sub = client?.subscription;
      const active = !!sub && sub.status === "active" && sub.endDate > getNow();
      if (!active) throw new Error("client.subscriptionExpired");

      // CLAUDE.md "Downgrade'da markaz tanlash oqimi": tarif pasayib faol
      // filiallar limitdan oshib ketgan bo'lsa, Client Owner majburiy modalda
      // tanlov qilmaguncha HECH QANDAY mutatsiya o'tmaydi (Staff bu yerga
      // yetib kelmaydi — bloklangan filial hodimi `fullStaffAuth`da to'xtaydi,
      // faol filial hodimi esa ishlayveradi: tanlov Owner'ning vazifasi).
      if (!req.staff) {
        const tariffDoc = sub.tariff && !sub.tariff.isDeleted ? sub.tariff : null;
        const limit = tariffDoc ? tariffDoc.centerLimit : sub.tariffSnapshot?.centerLimit;
        if (typeof limit === "number" && limit !== -1) {
          const activeCount = await Center.countDocuments({
            client: req.client._id,
            isDeleted: false,
            status: "active",
          });
          if (activeCount > limit) throw new Error("center.overflowPending");
        }
      }

      // Bloklangan filial — Read-Only: so'rov aniq shu filialga
      // (query/body orqali) qaratilgan bo'lsa mutatsiya rad etiladi.
      const targets = [req.query?.center, req.body?.centerId, req.body?.center]
        .filter((v) => typeof v === "string" && /^[a-f\d]{24}$/i.test(v));
      if (targets.length) {
        const blocked = await Center.exists({
          _id: { $in: targets },
          client: req.client._id,
          status: "blocked",
        });
        if (blocked) throw new Error("center.blocked");
      }
      next();
    } catch (error) {
      next(error);
    }
  },
};
