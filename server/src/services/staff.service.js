const Staff = require("../models/Staff");
const Center = require("../models/Center");
const Subject = require("../models/Subject");
const Client = require("../models/Client");
const { getHash, compareHash } = require("../utils/hash.util");
const { getNow } = require("../utils/date.util");
const envConfig = require("../configs/env.config");
const keyConfig = require("../configs/key.config");
const jwtUtil = require("../utils/jwt.util");
const redisUtil = require("../utils/redis.util");
const {
  sanitizeStaffPermissions,
  salaryTypeKeyOf,
  SALARY_TYPE_TARIFF_FLAG,
} = require("../utils/staffPermission.util");
const clientService = require("./client.service");
const audit = require("../utils/audit.util");
const { emitArchiveChanged } = require("../utils/archive.util");

const PAGE_SIZE = 50;

// Faqat shu rollar uchun `subjects` ma'noli — resepshinga hech qachon
// saqlanmaydi (rol o'zgarganda ham tozalanadi, permissions kabi).
const TEACHING_ROLES = ["teacher", "assistant"];

// Sessiya keshini (`fullStaffAuth` o'qiydigan `staff:{id}`) tashlash —
// keyingi so'rov hodimni bazadan qayta o'qiydi. Aks holda bloklash, ruxsat
// o'zgarishi yoki arxivlash kesh TTL (365 kun, sliding) tugaguncha ta'sir
// qilmasdi (QA 2026-10-02).
const dropSessionCache = (staffId) => redisUtil.del(keyConfig.staff(staffId));

const DTO = (data) => ({
  _id: data?._id,
  staffId: data?.staffId,
  client: data?.client,
  center: data?.center,
  name: data?.name,
  login: data?.login,
  role: data?.role,
  permissions: data?.permissions,
  subjects: (data?.subjects || []).map((s) => String(s)),
  salaryValue: data?.salaryValue,
  blocked: data?.blocked,
  introSeen: data?.introSeen || false,
  date: data?.date,
  lastUpdate: data?.lastUpdate,
});

// `subjects` — faqat teaching rollarga saqlanadi va faqat shu client+center'ga
// tegishli fanlar bilan cheklanadi (boshqa filialning fan ID'si yuborilsa jim
// tashlab yuboriladi — Group.service'dagi `sameSubjectIds` naqshiga o'xshab
// qat'iy xato emas, chunki bu yerda checkbox ro'yxati allaqachon filial bilan
// cheklangan bo'ladi frontendda).
const resolveSubjects = async (clientId, centerId, role, subjectIds) => {
  if (!TEACHING_ROLES.includes(role)) return [];
  if (!Array.isArray(subjectIds) || !subjectIds.length) return [];

  const valid = await Subject.find({
    _id: { $in: subjectIds },
    client: clientId,
    center: centerId,
    isDeleted: false,
  }).select("_id");

  return valid.map((s) => s._id);
};

// Client'ning faol obunasidan `teacherLimit`/`receptionLimit`ni aniqlaydi —
// center.service.js dagi `getCenterLimit` bilan bir xil naqsh. `teacherLimit`
// TEACHING_ROLES (teacher+assistant) uchun, `receptionLimit` esa qolgan
// (reception) rol uchun.
const getStaffLimits = async (clientId) => {
  const client = await Client.findOne({ _id: clientId, isDeleted: false }).populate({
    path: "subscription",
    populate: { path: "tariff" },
  });
  if (!client || !client.subscription) throw new Error("client.noActiveSubscription");

  const sub = client.subscription;
  const tariffDoc = sub.tariff?._id ? sub.tariff : null;
  const source = tariffDoc || sub.tariffSnapshot || {};
  return { teacherLimit: source.teacherLimit, receptionLimit: source.receptionLimit };
};

// Refresh token yo'q — access token muddatsiz (jwtUtil.sign expiresIn'siz).
// Sessiya faqat signOut yoki Redis'dagi `staffAccess` kaliti boshqa qurilma
// login qilganda almashtirilganda tugaydi.
const issueAccessToken = (staffId) => jwtUtil.sign({ _id: staffId }, envConfig.STAFF_JWT_SECRET);

// Hodimga beriladigan OYLIK TURI tarifda ochiq bo'lishi shart (tarif flagi
// `staff.salary.*`). Tarif pasaygandan keyin hodimda allaqachon turgan tur
// (o'zgartirilmasa) saqlanib qoladi — aks holda boshqa maydonni tahrirlash
// hodimning oyligini jimgina o'chirib yuborardi.
const assertSalaryTypeAllowed = async (clientId, nextPermissions, prevPermissions = []) => {
  const nextKey = salaryTypeKeyOf(nextPermissions);
  if (!nextKey || nextKey === salaryTypeKeyOf(prevPermissions)) return;
  const allowed = await clientService.hasPermission(clientId, SALARY_TYPE_TARIFF_FLAG[nextKey]);
  if (!allowed) throw new Error("staff.salaryTypeNotInTariff");
};

module.exports = {
  dropSessionCache,
  DTO,

  // ---- CRUD (Client Owner tomonidan boshqariladi, clientId bo'yicha tenant isolation) ----
  create: async (clientId, body, actor = null) => {
    const { centerId, name, login, password, role, permissions, salaryValue, subjects } = body;
    if (!centerId || !name || !login || !password) throw new Error("staff.fillTheRows");
    if (!Staff.ROLES.includes(role)) throw new Error("staff.invalidRole");
    if (salaryValue != null && salaryValue < 0) throw new Error("staff.invalidSalaryValue");

    const center = await Center.findOne({ _id: centerId, client: clientId, isDeleted: false });
    if (!center) throw new Error("center.notFound");

    const trimmedLogin = login.trim();
    const exists = await Staff.findOne({ login: trimmedLogin, isDeleted: false });
    if (exists) throw new Error("staff.loginTaken");

    const isTeaching = TEACHING_ROLES.includes(role);
    const { teacherLimit, receptionLimit } = await getStaffLimits(clientId);
    const limit = isTeaching ? teacherLimit : receptionLimit;
    if (limit !== -1) {
      const countFilter = {
        client: clientId,
        isDeleted: false,
        role: isTeaching ? { $in: TEACHING_ROLES } : role,
      };
      const count = await Staff.countDocuments(countFilter);
      if (count >= limit) {
        throw new Error(isTeaching ? "staff.teacherLimitReached" : "staff.receptionLimitReached");
      }
    }

    await assertSalaryTypeAllowed(clientId, permissions);

    const staff = await Staff.create({
      client: clientId,
      center: center._id,
      name: name.trim(),
      login: trimmedLogin,
      password: await getHash(password.trim()),
      role,
      permissions: sanitizeStaffPermissions(role, permissions),
      subjects: await resolveSubjects(clientId, center._id, role, subjects),
      salaryValue: salaryValue ?? null,
    });

    void audit.log({
      actor,
      client: clientId,
      center: staff.center,
      action: "staff:create",
      entity: { type: "staff", id: staff._id, label: staff.name },
      meta: { role: staff.role, login: staff.login },
    });

    return { ...DTO(staff), plainPassword: password.trim() };
  },

  // Yengil ro'yxat — Owner HAM, Staff HAM (masalan Guruh/Xona sahifalaridagi
  // "O'qituvchi" filtri/label uchun) chaqira oladi. To'liq `list()`dan farqli,
  // maosh/login/permission kabi nozik maydonlar YO'Q — faqat _id/name/role.
  lookup: async (clientId, { center = "", role = "" }) => {
    const filter = { client: clientId, isDeleted: false, blocked: false };
    if (center) filter.center = center;
    if (role && Staff.ROLES.includes(role)) filter.role = role;

    // `center` SHART: Guruh dialogi ro'yxatni filial bo'yicha filtrlaydi
    // (`s.center === form.center`) — u bo'lmasa tanlov ro'yxati bo'sh chiqadi.
    // `subjects` — Guruh dialogida teacher/assistant ro'yxati tanlangan fan
    // bo'yicha ham filtrlanadi (o'sha fanni o'qitmaydigan hodim ko'rinmaydi).
    const staffs = await Staff.find(filter).select("name role center subjects").sort({ name: 1 });
    return staffs.map((s) => ({
      _id: s._id,
      name: s.name,
      role: s.role,
      center: String(s.center),
      subjects: (s.subjects || []).map((id) => String(id)),
    }));
  },

  list: async (clientId, { page = 1, search = "", center = "", role = "" }) => {
    const trimmedSearch = search?.trim();
    const baseFilter = { client: clientId, isDeleted: false };
    if (center) baseFilter.center = center;
    if (role && Staff.ROLES.includes(role)) baseFilter.role = role;

    if (trimmedSearch) {
      const regex = new RegExp(trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const data = await Staff.find({
        ...baseFilter,
        $or: [{ name: regex }, { login: regex }],
      }).sort({ createdAt: -1 });

      return {
        data: data.map(DTO),
        meta: { page: 1, limit: data.length, total: data.length, totalPages: 1 },
      };
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const skip = (pageNum - 1) * PAGE_SIZE;

    const [data, total] = await Promise.all([
      Staff.find(baseFilter).sort({ createdAt: -1 }).skip(skip).limit(PAGE_SIZE),
      Staff.countDocuments(baseFilter),
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
    const staff = await Staff.findOne({ _id: id, client: clientId, isDeleted: false });
    if (!staff) throw new Error("staff.notFound");
    return DTO(staff);
  },

  // Excel export — list() bilan bir xil filtr, sahifalashsiz, Filial nomi
  // hal qilingan holda.
  exportList: async (clientId, { search = "", center = "", role = "" }) => {
    const trimmedSearch = search?.trim();
    const baseFilter = { client: clientId, isDeleted: false };
    if (center) baseFilter.center = center;
    if (role && Staff.ROLES.includes(role)) baseFilter.role = role;
    if (trimmedSearch) {
      const regex = new RegExp(trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      baseFilter.$or = [{ name: regex }, { login: regex }];
    }

    const staffs = await Staff.find(baseFilter).sort({ createdAt: -1 });
    const centerIds = [...new Set(staffs.map((s) => String(s.center)))];
    const centers = await Center.find({ _id: { $in: centerIds } }, { name: 1 });
    const centerMap = Object.fromEntries(centers.map((c) => [String(c._id), c.name]));

    return staffs.map((s) => ({
      name: s.name,
      login: s.login,
      centerName: centerMap[String(s.center)] || "—",
      role: s.role,
      blocked: s.blocked,
    }));
  },

  update: async (clientId, id, body, actor = null) => {
    const staff = await Staff.findOne({ _id: id, client: clientId, isDeleted: false });
    if (!staff) throw new Error("staff.notFound");
    // Audit uchun — ayniqsa ruxsatlar o'zgarishi (kim kimga nima berdi).
    const before = {
      name: staff.name,
      login: staff.login,
      role: staff.role,
      permissions: [...(staff.permissions || [])],
      center: staff.center ? String(staff.center) : null,
      salaryValue: staff.salaryValue,
    };

    if (body.login && body.login.trim() !== staff.login) {
      const trimmedLogin = body.login.trim();
      const exists = await Staff.findOne({
        login: trimmedLogin,
        isDeleted: false,
        _id: { $ne: id },
      });
      if (exists) throw new Error("staff.loginTaken");
      staff.login = trimmedLogin;
    }

    if (body.name) staff.name = body.name.trim();
    if (body.password) staff.password = await getHash(body.password.trim());
    if (body.role) {
      if (!Staff.ROLES.includes(body.role)) throw new Error("staff.invalidRole");
      staff.role = body.role;
    }
    if (body.permissions) {
      await assertSalaryTypeAllowed(clientId, body.permissions, staff.permissions);
      staff.permissions = body.permissions;
    }
    // Rol o'zgargan bo'lsa ham qayta tozalanadi — resepshin -> o'qituvchi
    // bo'lganda eski "to'lov olish" kabi ruxsatlar qolib ketmasin.
    staff.permissions = sanitizeStaffPermissions(staff.role, staff.permissions);
    if (body.salaryValue !== undefined) {
      if (body.salaryValue != null && body.salaryValue < 0) {
        throw new Error("staff.invalidSalaryValue");
      }
      staff.salaryValue = body.salaryValue;
    }
    if (body.centerId) {
      const center = await Center.findOne({
        _id: body.centerId,
        client: clientId,
        isDeleted: false,
      });
      if (!center) throw new Error("center.notFound");
      staff.center = center._id;
    }
    // Rol resepshinga o'tsa (yoki `subjects` umuman yuborilmasa lekin rol
    // teaching bo'lmasa) ro'yxat tozalanadi — permissions bilan bir xil qoida.
    staff.subjects = await resolveSubjects(clientId, staff.center, staff.role, body.subjects);

    await staff.save();
    await dropSessionCache(staff._id);

    const changes = audit.diff(before, {
      name: staff.name,
      login: staff.login,
      role: staff.role,
      permissions: [...(staff.permissions || [])],
      center: staff.center ? String(staff.center) : null,
      salaryValue: staff.salaryValue,
    });
    if (body.password) changes.push({ field: "password", from: null, to: "••••" });
    if (changes.length) {
      void audit.log({
        actor,
        client: clientId,
        center: staff.center,
        action: "staff:update",
        entity: { type: "staff", id: staff._id, label: staff.name },
        changes,
      });
    }
    return DTO(staff);
  },

  // Arxivlash — API_CONTRACT_archive.md. `blocked` TEGILMAYDI: bloklash
  // (vaqtincha kirishni yopish) mustaqil funksiya bo'lib qoladi.
  // Arxivlangan hodim login qila olmaydi (signIn `isDeleted: false` qidiradi),
  // oylik tarixi esa saqlanadi — moliyaviy yozuvlar hech qachon o'chmaydi.
  remove: async (clientId, id, actor = null) => {
    const staff = await Staff.findOne({ _id: id, client: clientId, isDeleted: false });
    if (!staff) throw new Error("staff.notFound");

    staff.isDeleted = true;
    staff.deletedAt = getNow();
    await staff.save();
    await dropSessionCache(staff._id);

    emitArchiveChanged(clientId, staff.center, "staff", staff._id, "archived");
    void audit.log({
      actor,
      client: clientId,
      center: staff.center,
      action: "staff:archived",
      entity: { type: "staff", id: staff._id, label: staff.name },
    });

    return true;
  },

  setBlocked: async (clientId, id, blocked, actor = null) => {
    const staff = await Staff.findOne({ _id: id, client: clientId, isDeleted: false });
    if (!staff) throw new Error("staff.notFound");

    staff.blocked = blocked;
    await staff.save();
    await dropSessionCache(staff._id);
    void audit.log({
      actor,
      client: clientId,
      center: staff.center,
      action: blocked ? "staff:blocked" : "staff:unblocked",
      entity: { type: "staff", id: staff._id, label: staff.name },
    });
    return DTO(staff);
  },

  // ---- Staff auth (client panel — Hodim login) ----
  signIn: async (body) => {
    const { login, password } = body;
    if (!login || !password) throw new Error("auth.fillTheRows");

    const staff = await Staff.findOne({ login: login.trim(), isDeleted: false });
    if (!staff) throw new Error("auth.notFound");
    if (staff.blocked) throw new Error("staff.blocked");

    const checkPass = await compareHash(password?.trim(), staff.password);
    if (!checkPass) throw new Error("auth.notFound");

    const data = DTO(staff);
    const access = issueAccessToken(staff._id);

    staff.access = access;
    const key = keyConfig.staff(staff._id);
    const accessKey = keyConfig.staffAccess(staff._id);
    await Promise.all([
      staff.save(),
      redisUtil.set(key, data, envConfig.STAFF_SESSION_TTL),
      redisUtil.set(accessKey, access, envConfig.STAFF_SESSION_TTL),
    ]);

    return { data, access };
  },

  // Staff o'z profilini o'zi yangilashi — FAQAT ism va parol (login/rol/
  // permissions/markaz/salaryValue Client Owner orqali `/staffs/:id`da
  // boshqariladi, bu yerga tegishli emas).
  updateOwnProfile: async (staffId, body) => {
    const { name, currentPassword, newPassword } = body;
    const wantsPasswordChange = !!currentPassword || !!newPassword;
    if (!name && !wantsPasswordChange) throw new Error("staff.fillTheRows");
    if (wantsPasswordChange && (!currentPassword || !newPassword)) {
      throw new Error("staff.fillTheRows");
    }

    const staff = await Staff.findOne({ _id: staffId, isDeleted: false });
    if (!staff) throw new Error("auth.notFound");

    if (wantsPasswordChange) {
      const matches = await compareHash(currentPassword.trim(), staff.password);
      if (!matches) throw new Error("auth.notFound");
      staff.password = await getHash(newPassword.trim());
    }

    if (name) staff.name = name.trim();
    await staff.save();

    const data = DTO(staff);
    // Redis'dagi sessiya keshi ham yangilanadi — aks holda `fullStaffAuth`
    // sessiya TTL tugagunicha eski ismni qaytaraveradi (signIn'dagi bilan
    // bir xil kalit, `keyConfig.staff`).
    await redisUtil.set(keyConfig.staff(staff._id), data, envConfig.STAFF_SESSION_TTL);

    return data;
  },

  markIntroSeen: async (staffId) => {
    const staff = await Staff.findOneAndUpdate(
      { _id: staffId, isDeleted: false },
      { $set: { introSeen: true } },
      { new: true },
    );
    if (!staff) throw new Error("auth.notFound");

    const data = DTO(staff);
    // updateOwnProfile bilan bir xil naqsh — Redis sessiya keshi ham
    // yangilanadi, aks holda `fullStaffAuth` TTL tugagunicha eski
    // `introSeen:false`ni qaytaraveradi.
    await redisUtil.set(keyConfig.staff(staff._id), data, envConfig.STAFF_SESSION_TTL);

    return true;
  },

  signOutSession: async (staff) => {
    const key = keyConfig.staff(staff._id);
    const accessKey = keyConfig.staffAccess(staff._id);
    await Promise.all([
      Staff.updateOne({ _id: staff._id }, { $set: { access: "" } }),
      redisUtil.del(key),
      redisUtil.del(accessKey),
    ]);

    return true;
  },
};
