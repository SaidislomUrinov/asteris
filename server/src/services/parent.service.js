const crypto = require("crypto");
const moment = require("moment-timezone");
const { isValidObjectId } = require("mongoose");
const Parent = require("../models/Parent");
const Student = require("../models/Student");
const Center = require("../models/Center");
const Client = require("../models/Client");
const Staff = require("../models/Staff");
const Group = require("../models/Group");
const Subject = require("../models/Subject");
const Room = require("../models/Room");
const Attendance = require("../models/Attendance");
const Grade = require("../models/Grade");
const Syllabus = require("../models/Syllabus");
const BillingSetting = require("../models/BillingSetting");
const Notification = require("../models/Notification");
const Homework = require("../models/Homework");
const envConfig = require("../configs/env.config");
const jwtUtil = require("../utils/jwt.util");
const { getNow, todayString, dateStringToUnix, addDays } = require("../utils/date.util");
const { normalizeTelegramPhone } = require("../utils/phone.util");
const { listLessonDates, JS_DAY_TO_CODE } = require("../utils/lessonDays.util");
const { flattenLessons, getDoneDates } = require("../utils/syllabusProgress.util");
const { emitParentTelegramChanged } = require("../utils/parentTelegram.util");
const { groupStudentsSummary, rankInSummary } = require("../utils/gradeScore.util");
const { BADGE_FEATURE, GRADE_BADGES } = require("../utils/badge.util");
const { latestPhoto, photoFor } = require("../utils/studentPhoto.util");

const TZ = "Asia/Tashkent";
const RECEIPT_VERIFY_BASE = "https://wenet.uz/payment/verify";
const NOTIF_PAGE_SIZE = 30;
const INIT_DATA_MAX_AGE_SEC = 24 * 3600;
const LANGS = ["uz", "ru", "en"];
const ROLES = ["parent", "student"];
// Rolga qarab o'chiriladigan/e'tiborsiz qoldiriladigan mute kalitlari.
const MUTE_KEYS = ["attendance", "lessonFinished", "payment", "debt", "lessonReminder", "homework", "homeworkMissed", "badge"];
const STUDENT_IGNORED_MUTE = ["debt", "payment"];

// ---------------------------------------------------------------------------
// ROL (API_CONTRACT_student_role_homework.md §1.1)
// `parent` → `Student.parentTelegramPhone === phone`, `student` →
// `Student.telegramPhone === phone` (API_CONTRACT_telegram_phone.md §3 — Telegram
// mosligi FAQAT Telegram raqami bo'yicha; asosiy telefon bilan emas).
// Avvalgi `$or: [{parentPhone},{phone}]` qidiruvi hamma joyda shu BITTA
// shartga almashgan.
// ---------------------------------------------------------------------------

const roleMatch = (role, phone) =>
  role === "student" ? { telegramPhone: phone } : { parentTelegramPhone: phone };

// Bo'sh / tanib bo'lmaydigan raqam hech qachon moslik bermaydi.
const tgPhone = (raw) => normalizeTelegramPhone(raw) || "";

// Raqam har bir rolda nechta (o'chirilmagan) o'quvchiga mos keladi.
const availableRoles = async (rawPhone) => {
  const phone = tgPhone(rawPhone);
  if (!phone) return { parent: 0, student: 0 };
  const [parent, student] = await Promise.all([
    Student.countDocuments({ isDeleted: false, parentTelegramPhone: phone }),
    Student.countDocuments({ isDeleted: false, telegramPhone: phone }),
  ]);
  return { parent, student };
};

const rolesList = (counts) => ROLES.filter((r) => counts[r] > 0);

// `role` saqlangan bo'lsa — o'sha; `null` (eski hujjat / tanlanmagan) →
// parentTelegramPhone mosligi bo'lsa "parent", aks holda telegramPhone mosligi bo'lsa
// "student", hech biri bo'lmasa "parent". `counts` berilsa qayta so'ralmaydi.
const effectiveRole = async (parent, counts = null) => {
  const c = counts || (await availableRoles(parent?.phone));
  // Saqlangan rolda o'quvchi qolmagan bo'lsa (markaz raqamni o'zgartirgan) —
  // foydalanuvchi bo'sh rolda "qamalib" qolmasin, mavjud rolga o'tadi.
  if (ROLES.includes(parent?.role) && c[parent.role] > 0) return parent.role;
  if (c.parent > 0) return "parent";
  if (c.student > 0) return "student";
  return "parent";
};

// Farzandlar (yoki o'quvchining o'zi) — rolga mos, o'chirilmagan o'quvchilar.
// Faqat aktiv a'zoliklar hisobga olinadi; markaz nomi bilan birga qaytadi
// (bot xabari uchun).
const findChildren = async (rawPhone, role = "parent") => {
  const phone = tgPhone(rawPhone);
  if (!phone) return [];
  const students = await Student.find({
    isDeleted: false,
    ...roleMatch(role, phone),
  })
    .select("fullName phone parentPhone photos groups.group groups.center groups.client groups.status")
    .lean();
  if (!students.length) return [];

  const centerIds = [...new Set(students.flatMap((s) => s.groups.map((g) => String(g.center))))];
  const centers = await Center.find({ _id: { $in: centerIds }, isDeleted: false }).select("name").lean();
  const centerName = Object.fromEntries(centers.map((c) => [String(c._id), c.name]));

  // Guruh nomlari — o'quvchi roli uchun bot "Siz quyidagi guruhlarda o'qiysiz" ro'yxati.
  const groupIds = [...new Set(students.flatMap((s) => s.groups.filter((g) => g.status === "active").map((g) => String(g.group))))];
  const groups = await Group.find({ _id: { $in: groupIds } }).select("name subject activeId pendingId status kind").lean();
  const subjects = await Subject.find({ _id: { $in: [...new Set(groups.map((g) => String(g.subject)))] } })
    .select("name")
    .lean();
  const subjectName = Object.fromEntries(subjects.map((x) => [String(x._id), x.name]));
  const groupName = Object.fromEntries(groups.map((g) => [String(g._id), groupLabelOf(g, subjectName[String(g.subject)])]));

  return students.map((s) => {
    const active = s.groups.filter((g) => g.status === "active" && centerName[String(g.center)]);
    const byCenter = new Map();
    for (const g of active) {
      const k = String(g.center);
      if (!byCenter.has(k)) byCenter.set(k, { center: k, centerName: centerName[k], groupCount: 0, groupNames: [] });
      const bucket = byCenter.get(k);
      bucket.groupCount++;
      if (groupName[String(g.group)]) bucket.groupNames.push(groupName[String(g.group)]);
    }
    return {
      _id: s._id,
      fullName: s.fullName,
      isSelf: role === "student",
      centers: [...byCenter.values()],
      // Ota-ona cross-tenant — eng so'nggi rasm (API_CONTRACT_student_photo_everywhere.md §1).
      photo: latestPhoto(s),
    };
  });
};

// Shu chat hodim/owner sifatida ulanganmi — `/start` marshrutlash uchun.
const isStaffChat = async (chatId) => {
  const id = String(chatId);
  return (
    !!(await Client.exists({ "telegram.chatId": id, isDeleted: false })) ||
    !!(await Staff.exists({ "telegram.chatId": id, isDeleted: false }))
  );
};

const findByChat = async (chatId) => await Parent.findOne({ "telegram.chatId": String(chatId) });

// Ota-ona botni bloklab, keyin /start bossa — xabarlar qayta yoqiladi.
const unblock = async (chatId) => {
  const parent = await Parent.findOneAndUpdate(
    { "telegram.chatId": String(chatId), "telegram.blockedAt": { $ne: null } },
    { $set: { "telegram.blockedAt": null } },
    { new: true, projection: { phone: 1 } },
  ).lean();
  // O'quvchi ro'yxatlaridagi "Ulangan" belgisi (API_CONTRACT_student_contact_telegram.md §4).
  if (parent) void emitParentTelegramChanged([parent.phone]);
};

// Rol tanlangach (bot `prole:*`): shu rolda o'quvchilar bo'lsa Parent
// yaratiladi / yangilanadi (raqam almashgan bo'lsa ham). Topilmasa hech
// narsa yozilmaydi.
const linkByContact = async ({ chatId, userId, phone, name, lang, role = "parent" }) => {
  if (!ROLES.includes(role)) return { ok: false, children: [] };
  const children = await findChildren(phone, role);
  if (!children.length) return { ok: false, children: [] };

  let parent = await findByChat(chatId);
  // Raqam almashgan bo'lsa eski raqamdagi o'quvchilar ham yangilanadi.
  const prevPhone = parent?.phone || "";
  if (!parent) parent = new Parent({ phone, telegram: { chatId: String(chatId) } });
  parent.phone = phone;
  parent.name = name || parent.name;
  parent.telegram.userId = userId ? String(userId) : parent.telegram.userId;
  parent.telegram.lang = lang || parent.telegram.lang;
  parent.telegram.linkedAt = getNow();
  parent.telegram.blockedAt = null;
  parent.role = role;
  await parent.save();
  void emitParentTelegramChanged([parent.phone, prevPhone]);
  return { ok: true, parent, children };
};

// Ulangan foydalanuvchi rolini almashtiradi (bot `/role` va WebApp Settings).
// Rol shu raqam uchun mavjud (kamida bitta mos o'quvchi) bo'lishi shart.
const setRole = async (parent, role) => {
  if (!ROLES.includes(role)) throw new Error("parent.invalidRole");
  const counts = await availableRoles(parent.phone);
  if (!(counts[role] > 0)) throw new Error("parent.roleNotAvailable");
  parent.role = role;
  await parent.save();
  // "Ota-ona Telegrami ulangan" belgisi faqat parent roliga bog'liq.
  void emitParentTelegramChanged([parent.phone]);
  return parent;
};

const setLang = async (chatId, lang) => {
  if (!["uz", "ru", "en"].includes(lang)) return null;
  return await Parent.findOneAndUpdate(
    { "telegram.chatId": String(chatId) },
    { $set: { "telegram.lang": lang } },
    { new: true },
  );
};

// Botdan uzish — hujjat O'CHIRILADI (bu moliyaviy yozuv emas, shunchaki
// ulanish; soft-delete qilinsa `chatId` unique indeksi qayta ulanishga
// to'sqinlik qilardi).
const unlink = async (chatId) => {
  // Raqam O'CHIRISHDAN OLDIN olinadi — keyin hujjat yo'q.
  const parent = await Parent.findOne({ "telegram.chatId": String(chatId) }, { phone: 1 }).lean();
  await Parent.deleteOne({ "telegram.chatId": String(chatId) });
  if (parent) void emitParentTelegramChanged([parent.phone]);
  return { ok: true };
};

// ---------------------------------------------------------------------------
// WebApp API (API_CONTRACT_parent.md §4)
// ---------------------------------------------------------------------------

const ParentDTO = (p) => ({
  _id: p._id,
  name: p.name || "",
  phone: p.phone,
  lang: p.telegram?.lang || "uz",
  // Saqlangan rol (null bo'lishi mumkin) — aniq rol `me()` da (`effectiveRole`).
  role: p.role || null,
  mute: Object.fromEntries(MUTE_KEYS.map((k) => [k, !!p.mute?.[k]])),
});

// Telegram WebApp initData HMAC tekshiruvi (§4.1): secret = HMAC_SHA256("WebAppData",
// botToken); hash = HMAC_SHA256(secret, data_check_string). `auth_date` 24 soat.
const verifyInitData = (initData, botToken) => {
  if (!initData || typeof initData !== "string" || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const computed = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
  if (computed.length !== hash.length || !crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hash))) return null;
  const authDate = Number(params.get("auth_date"));
  if (!authDate || getNow() - authDate > INIT_DATA_MAX_AGE_SEC) return null;
  try {
    return JSON.parse(params.get("user") || "null");
  } catch {
    return null;
  }
};

const signAccess = (parent) =>
  jwtUtil.sign({ _id: String(parent._id), chatId: String(parent.telegram.chatId) }, envConfig.PARENT_JWT_SECRET, envConfig.PARENT_ACCESS_EXPIRES_IN);

// POST /parent-auth/telegram — faqat `{ initData }`; kirish yagona yo'l — Telegram
// HMAC imzosi (dev/chatId bypass yo'q).
const authTelegram = async ({ initData }) => {
  const botToken = (await require("./systemSetting.service").getRaw())?.telegram?.botToken || envConfig.TELEGRAM_BOT_TOKEN;
  const user = verifyInitData(initData, botToken);
  if (!user?.id) throw new Error("parent.invalidInitData");
  const uid = String(user.id);

  // ISHCHI (API_CONTRACT_worker_webapp.md §1) — rol so'ralmaydi, ustuvorlik:
  // Client (Boshliq) > Staff > Ota-ona/O'quvchi. Shaxsiy chatda userId === chatId.
  // Token va Redis sessiyasi mavjud Client/Staff zanjirining o'zida (alohida
  // "tg" slot'i), shuning uchun WebApp mavjud endpointlarni o'zgarishsiz chaqiradi.
  const workerService = require("./worker.service");
  const client = await Client.findOne({ "telegram.chatId": uid, isDeleted: false });
  if (client) {
    if (client.blocked) throw new Error("client.blocked");
    const { data, access } = await require("./client.service").signInTelegram(client);
    return { kind: "owner", access, worker: await workerService.me({ client: data, staff: null }) };
  }

  const [staff] = await Staff.find({ "telegram.chatId": uid, isDeleted: false, blocked: false })
    .sort({ "telegram.linkedAt": -1 })
    .limit(1);
  if (staff) {
    const center = await Center.findById(staff.center).select("status");
    if (center?.status === "blocked") throw new Error("center.blocked");
    // Egasi (Client) bloklangan/o'chirilgan bo'lsa — `tenantAuth` bilan bir xil qoida.
    const owner = await Client.findOne({ _id: staff.client, isDeleted: false }).select("blocked");
    if (!owner) throw new Error("auth.failed");
    if (owner.blocked) throw new Error("client.blocked");
    const { data, access } = await require("./staff.service").signInTelegram(staff);
    return {
      kind: "staff",
      access,
      worker: await workerService.me({ client: { _id: staff.client }, staff: data }),
    };
  }

  // OTA-ONA / O'QUVCHI — eski oqim o'zgarishsiz, faqat `kind` qo'shildi.
  if (!envConfig.PARENT_JWT_SECRET) throw new Error("parent.authUnavailable");
  // Shaxsiy chatda userId === chatId — eski hujjatlarda userId bo'lmasa chatId bo'yicha.
  const parent = await Parent.findOne({ $or: [{ "telegram.userId": uid }, { "telegram.chatId": uid }] });
  if (!parent) throw new Error("parent.notLinked");
  // `me()` — aniq rol (effectiveRole) bilan. Avval saqlangan `role` (null
  // bo'lishi mumkin) qaytarilardi va o'quvchi rolida WebApp birinchi
  // ochilishda "ota-ona" deb hisoblab, "To'lovlar" tabini ko'rsatib qo'yardi.
  return { kind: "parent", access: signAccess(parent), parent: await me(parent) };
};

// Ota-onaga tegishli (o'chirilmagan) o'quvchilar — Mongoose hujjatlari
// (computeBilling `entry.parent()` ga tayanmaydi, lekin subdoc'lar kerak).
const findStudentsOf = async (parent, role = null) =>
  await Student.find({ isDeleted: false, ...roleMatch(role || (await effectiveRole(parent)), parent.phone) });

// O'quvchi roli uchun moliyaviy endpointlar yopiq (§3.4).
const assertNotStudent = async (parent) => {
  if ((await effectiveRole(parent)) === "student") throw new Error("parent.forbiddenForStudent");
};

// Markaz "ulanganmi" — faqat markazning o'z sozlamasi (`parentNotifications.enabled`).
// Ota-ona nazorati TARIFGA BOG'LIQ EMAS: u har bir filial uchun doim ochiq
// (mahsulotning asosiy ustunligi), shuning uchun bu yerda tarif tekshirilmaydi.
const makeLinkChecker = () => async (center) =>
  !!center && center.parentNotifications?.enabled !== false;

// Tenant xavfsizligi (§4.10): entry ota-onaning farzandiga tegishli bo'lishi
// va markazi "ulangan" bo'lishi shart. Qaytaradi { student, entry, group, center, cycleMode }.
const resolveEntry = async (parent, entryId) => {
  if (!isValidObjectId(entryId)) throw new Error("parent.entryNotFound");
  const student = await Student.findOne({
    "groups._id": entryId,
    isDeleted: false,
    ...roleMatch(await effectiveRole(parent), parent.phone),
  });
  const entry = student?.groups?.id(entryId);
  // Arxivlangan a'zolik ham ochiladi — undagi qarz ota-onaga ko'rinishi shart
  // (ro'yxatda faqat qarzi bor arxiv a'zoliklar chiqadi, `children()`).
  if (!student || !entry) throw new Error("parent.entryNotFound");
  const [center, group] = await Promise.all([
    Center.findOne({ _id: entry.center, isDeleted: false }).lean(),
    Group.findById(entry.group).lean(),
  ]);
  if (!center || !group) throw new Error("parent.entryNotFound");
  if (!(await makeLinkChecker()(center))) throw new Error("parent.centerNotLinked");
  const billingDoc = await BillingSetting.findOne({ center: entry.center }).select("cycleMode").lean();
  return { student, entry, group, center, cycleMode: billingDoc?.cycleMode || "anchor" };
};

// Individual darsda fan nomi (WebApp alohida "Individual dars" belgisini qo'yadi).
const groupLabelOf = (group, subjectName) =>
  (group?.kind === "individual" ? subjectName : group?.name) || subjectName || "";

// Oy chegarasi "YYYY-MM" — noto'g'ri bo'lsa joriy oy.
const normalizeMonth = (month) =>
  /^\d{4}-(0[1-9]|1[0-2])$/.test(month || "") ? month : moment.tz(TZ).format("YYYY-MM");

// Guruhning shu oydagi dars sanalari (days bo'yicha; activatedAt'dan,
// finishedAt'gacha, bugungacha).
// Guruh/markaz bayramlari (dars bo'lmagan kunlar) chiqarib tashlanadi —
// ota-ona kalendarida ular "belgilanmagan dars" bo'lib ko'rinmasin.
const lessonDaysOfMonth = async (group, month) => {
  if (!group?.activatedAt) return [];
  const start = Math.max(dateStringToUnix(`${month}-01`), group.activatedAt);
  const monthEnd = moment.tz(`${month}-01`, "YYYY-MM-DD", TZ).endOf("month").unix() + 1;
  const tomorrow = addDays(dateStringToUnix(todayString()), 1);
  const end = Math.min(monthEnd, tomorrow, group.finishedAt || Infinity);
  const dates = listLessonDates(group.days || [], start, end);
  if (!dates.length) return dates;
  const groupHolidayService = require("./groupHoliday.service");
  const calendarService = require("./calendar.service");
  const [groupHolidays, centerHolidays] = await Promise.all([
    groupHolidayService.listForMonth(group.client, group._id, month),
    calendarService.getCenterHolidayDates(group.center, month),
  ]);
  const off = new Set([...groupHolidays, ...centerHolidays].map((h) => h.date));
  return dates.filter((d) => !off.has(d));
};

// GET /parent/me (§3.1) — `role` aniq (effectiveRole), `availableRoles` —
// kamida bitta mos o'quvchi bor rollar.
const me = async (parent) => {
  const counts = await availableRoles(parent.phone);
  const role = await effectiveRole(parent, counts);
  return { ...ParentDTO(parent), role, availableRoles: rolesList(counts), childrenCount: counts[role] || 0 };
};

// PATCH /parent/role (§3.2)
const updateRole = async (parent, role) => {
  await setRole(parent, role);
  return await me(parent);
};

// GET /parent/children — butun daraxt (§4.3)
const children = async (parent) => {
  const { computeBilling } = require("./student.service");
  const role = await effectiveRole(parent);
  // O'quvchi roli — qarz/to'lov maydonlari qaytmaydi (§3.3).
  const hideMoney = role === "student";
  const students = await findStudentsOf(parent, role);
  if (!students.length) return [];

  // Arxivlangan a'zoliklar faqat qarzi borligi uchun (ota-ona rolida) olinadi —
  // pastda qarzsizlari tashlab yuboriladi.
  const keepEntry = (g) => g.status !== "archived" || !hideMoney;
  const entries = students.flatMap((s) => s.groups.filter(keepEntry));
  const ids = (key) => [...new Set(entries.map((e) => String(e[key])))];
  const [centers, groups, billingDocs] = await Promise.all([
    Center.find({ _id: { $in: ids("center") }, isDeleted: false }).lean(),
    Group.find({ _id: { $in: ids("group") } }).lean(),
    BillingSetting.find({ center: { $in: ids("center") } }).select("center cycleMode").lean(),
  ]);
  const centerMap = new Map(centers.map((c) => [String(c._id), c]));
  const groupMap = new Map(groups.map((g) => [String(g._id), g]));
  const cycleMap = new Map(billingDocs.map((b) => [String(b.center), b.cycleMode]));

  const [subjects, staffs, rooms] = await Promise.all([
    Subject.find({ _id: { $in: [...new Set(groups.map((g) => String(g.subject)))] } }).select("name").lean(),
    Staff.find({ _id: { $in: groups.map((g) => g.teacher).filter(Boolean) } }).select("name").lean(),
    Room.find({ _id: { $in: groups.map((g) => g.room).filter(Boolean) } }).select("name").lean(),
  ]);
  const nameMap = (list) => new Map(list.map((x) => [String(x._id), x.name]));
  const subjectName = nameMap(subjects);
  const staffName = nameMap(staffs);
  const roomName = nameMap(rooms);

  const isLinked = makeLinkChecker();
  const linkedMap = new Map();
  for (const c of centers) linkedMap.set(String(c._id), await isLinked(c));

  const today = todayString();
  const todayCode = JS_DAY_TO_CODE[moment.tz(TZ).day()];
  const since = moment.tz(TZ).subtract(30, "days").format("YYYY-MM-DD");
  const studentIds = students.map((s) => s._id);
  const activeGroupIds = [...new Set(entries.filter((e) => e.status === "active").map((e) => String(e.group)))];

  // 30 kunlik davomat/baho — bitta so'rovda, keyin o'quvchi bo'yicha guruhlanadi.
  const [attSessions, grades, todaySessions] = await Promise.all([
    Attendance.find({ group: { $in: activeGroupIds }, date: { $gte: since, $lte: today }, "records.student": { $in: studentIds } })
      .select("group date records")
      .lean(),
    Grade.find({ student: { $in: studentIds }, group: { $in: activeGroupIds }, date: { $gte: since, $lte: today } })
      .select("student group value")
      .lean(),
    Attendance.find({ group: { $in: activeGroupIds }, date: today }).select("group records").lean(),
  ]);
  const todayMap = new Map(todaySessions.map((a) => [String(a.group), a]));

  const result = [];
  for (const student of students) {
    const sid = String(student._id);
    const own = student.groups.filter(keepEntry);
    const ownActiveGroups = new Set(own.filter((g) => g.status === "active").map((g) => String(g.group)));

    // Stats — faqat ULANGAN markaz guruhlari bo'yicha (ma'lumot berilmaydigan
    // markazning davomati/baholari ham yashirin qolsin).
    const statGroups = new Set(
      own.filter((g) => g.status === "active" && linkedMap.get(String(g.center))).map((g) => String(g.group)),
    );
    let present = 0;
    let marked = 0;
    for (const a of attSessions) {
      if (!statGroups.has(String(a.group))) continue;
      const r = a.records.find((x) => String(x.student) === sid);
      if (!r) continue;
      marked++;
      if (r.status === "present") present++;
    }
    const myGrades = grades.filter((g) => String(g.student) === sid && statGroups.has(String(g.group)));
    const avgGrade = myGrades.length ? Math.round((myGrades.reduce((s, g) => s + g.value, 0) / myGrades.length) * 10) / 10 : null;

    let totalDebt = 0;
    const byCenter = new Map();
    const todayList = [];
    for (const entry of own) {
      const ck = String(entry.center);
      const center = centerMap.get(ck);
      if (!center) continue;
      if (!byCenter.has(ck))
        byCenter.set(ck, { center: { _id: center._id, name: center.name }, linked: !!linkedMap.get(ck), groups: [] });
      const bucket = byCenter.get(ck);
      if (!bucket.linked) continue;

      const group = groupMap.get(String(entry.group));
      if (!group) continue;
      const billing = computeBilling(entry, group, cycleMap.get(ck) || "anchor");
      const status =
        entry.status === "archived"
          ? "archived"
          : entry.status === "left"
            ? "left"
            : group.status === "finished"
              ? "finished"
              : "active";
      // Arxivdagi a'zolik faqat to'lanmagan qarzi bo'lsa ko'rsatiladi.
      if (status === "archived" && !(billing.debt > 0)) continue;
      // Qarz guruh holatidan qat'i nazar (chiqqan/yakunlangan/arxiv ham) jamiga
      // kiradi — u to'lanmaguncha ota-onaga ko'rinishi kerak.
      totalDebt += billing.debt || 0;

      const rec = todayMap.get(String(group._id))?.records?.find((r) => String(r.student) === sid) || null;
      const name = groupLabelOf(group, subjectName.get(String(group.subject)));
      bucket.groups.push({
        entryId: entry._id,
        groupId: group._id,
        name,
        subjectName: subjectName.get(String(group.subject)) || "",
        // Individual (1 kishilik) dars — WebApp reyting o'rniga "Individual" yozadi.
        isIndividual: group.kind === "individual",
        telegramLink: group.telegramLink || null,
        teacherName: staffName.get(String(group.teacher)) || "",
        roomName: roomName.get(String(group.room)) || "",
        days: group.days || [],
        startTime: group.startTime || "",
        endTime: group.endTime || "",
        status,
        price: hideMoney ? null : entry.price || 0,
        debt: hideMoney ? null : billing.debt || 0,
        nextDueDate: hideMoney ? null : billing.nextDueDate || null,
        todayStatus: rec?.status || null,
        late: !!rec?.late,
        // Guruh filialidagi (Client) rasm — API_CONTRACT_parent_group_photo.md
        photo: photoFor(student, entry.client || center.client),
      });
      if (status === "active" && ownActiveGroups.has(String(group._id)) && (group.days || []).includes(todayCode) && group.status === "active") {
        todayList.push({
          entryId: entry._id,
          name,
          centerName: center.name,
          startTime: group.startTime || "",
          endTime: group.endTime || "",
          status: rec?.status || null,
        });
      }
    }
    todayList.sort((a, b) => (a.startTime < b.startTime ? -1 : 1));

    result.push({
      student: {
        _id: student._id,
        fullName: student.fullName,
        phone: student.phone,
        isSelf: role === "student",
        photo: latestPhoto(student),
      },
      stats: {
        attendancePercent: marked ? Math.round((present / marked) * 100) : 0,
        avgGrade,
        totalDebt: hideMoney ? null : totalDebt,
      },
      // Faqat qarzsiz arxiv a'zoliklari bo'lgan markaz ko'rsatilmaydi.
      centers: [...byCenter.entries()]
        .filter(([ck, b]) => b.groups.length || own.some((g) => g.status !== "archived" && String(g.center) === ck))
        .map(([, b]) => b),
      today: todayList,
    });
  }
  return result;
};

// GET /parent/entries/:entryId/attendance?month= (§4.4)
const entryAttendance = async (parent, entryId, monthRaw) => {
  const { student, entry, group } = await resolveEntry(parent, entryId);
  const month = normalizeMonth(monthRaw);
  const sessions = await Attendance.find({
    group: entry.group,
    date: { $gte: `${month}-01`, $lte: `${month}-31` },
    "records.student": student._id,
  })
    .select("date records")
    .sort({ date: 1 })
    .lean();
  const summary = { present: 0, absent: 0, excused: 0, late: 0 };
  const days = [];
  for (const s of sessions) {
    const r = s.records.find((x) => String(x.student) === String(student._id));
    if (!r) continue;
    summary[r.status] = (summary[r.status] || 0) + 1;
    if (r.late) summary.late++;
    days.push({ date: s.date, status: r.status, late: !!r.late, reason: r.reason || "" });
  }
  return { month, days, summary, lessonDays: await lessonDaysOfMonth(group, month) };
};

// GET /parent/entries/:entryId/grades?month= (§4.5)
const entryGrades = async (parent, entryId, monthRaw) => {
  const { student, entry, group, center } = await resolveEntry(parent, entryId);
  const month = normalizeMonth(monthRaw);
  if (center.parentNotifications?.showGrades === false) return { month, items: [], avg: null, gradesHidden: true };

  const items = await Grade.find({ group: entry.group, student: student._id, date: { $gte: `${month}-01`, $lte: `${month}-31` } })
    .select("date value note")
    .sort({ date: 1 })
    .lean();

  // Mavzu (topic) — Syllabus'dan: davomat sanalari xronologik ro'yxatida
  // sananing tartib raqami + lessonOffset → yoyilgan darslar ro'yxatidagi dars.
  let topicOf = () => null;
  if (items.length) {
    const syllabus = await Syllabus.findOne({ group: entry.group, isDeleted: false }).select("modules").lean();
    if (syllabus?.modules?.length) {
      const lessons = flattenLessons(syllabus.modules);
      const doneDates = await getDoneDates(entry.client, entry.group);
      const offset = Number(group.lessonOffset) || 0;
      topicOf = (date) => {
        const idx = doneDates.indexOf(date);
        return idx === -1 ? null : lessons[offset + idx]?.title || null;
      };
    }
  }
  const avg = items.length ? Math.round((items.reduce((s, g) => s + g.value, 0) / items.length) * 10) / 10 : null;
  return {
    month,
    items: items.map((g) => ({ date: g.date, value: g.value, note: g.note || "", topic: topicOf(g.date) })),
    avg,
    gradesHidden: false,
  };
};

// To'lovni qabul qilgan nomi — Client Owner yoki Staff (id + kind).
const collectorNames = async (payments) => {
  const staffIds = payments.filter((p) => p.collectedByKind === "staff" && p.collectedBy).map((p) => p.collectedBy);
  const ownerIds = payments.filter((p) => p.collectedByKind === "owner" && p.collectedBy).map((p) => p.collectedBy);
  const [staffs, owners] = await Promise.all([
    staffIds.length ? Staff.find({ _id: { $in: staffIds } }).select("name").lean() : [],
    ownerIds.length ? Client.find({ _id: { $in: ownerIds } }).select("name").lean() : [],
  ]);
  const map = new Map([...staffs, ...owners].map((x) => [String(x._id), x.name]));
  return (p) => (p.collectedBy ? map.get(String(p.collectedBy)) || "" : "");
};

const paymentRow = (p, nameOf) => ({
  _id: p._id,
  amount: p.amount,
  type: p.type,
  status: p.status,
  forMonth: p.forMonth || "",
  date: p.date,
  code: p.code || null,
  collectedByName: nameOf(p),
});

// GET /parent/entries/:entryId/payments (§4.6) — studentService DTO'sidan
// (qayta hisoblanmaydi).
const entryPayments = async (parent, entryId) => {
  await assertNotStudent(parent);
  const { student, entry } = await resolveEntry(parent, entryId);
  // `includeArchived` — arxivlangan a'zolikning qarzi ham ko'rinadi.
  const dto = await require("./student.service").DTO(student, entry.client, "", { includeArchived: true });
  const g = dto.groups.find((x) => String(x._id) === String(entry._id));
  if (!g) throw new Error("parent.entryNotFound");
  const nameOf = await collectorNames(entry.payments || []);
  const rawById = new Map((entry.payments || []).map((p) => [String(p._id), p]));
  return {
    price: g.price,
    debt: g.debt,
    debtBreakdown: (g.debtBreakdown || []).map((r) => ({
      month: r.month,
      due: r.due,
      paid: r.paid,
      debt: r.debt,
      kind: r.kind,
      from: r.from || null, // bir oyda ikki qator bo'lsa ajratish uchun
      to: r.to || null,
    })),
    nextDueDate: g.nextDueDate || null,
    // `collectedBy` DTO'da yo'q — xom subdoc'dan olinadi (moliyaviy maydonlar bir xil).
    payments: (g.payments || [])
      .map((p) => paymentRow(rawById.get(String(p._id)) || p, nameOf))
      .sort((a, b) => b.date - a.date),
    receiptVerifyBase: RECEIPT_VERIFY_BASE,
  };
};

// GET /parent/payments — barcha farzandlar (§4.7)
const allPayments = async (parent) => {
  await assertNotStudent(parent);
  const tree = await children(parent);
  const debts = [];
  const monthMap = new Map();
  const students = await findStudentsOf(parent);
  const studentMap = new Map(students.map((s) => [String(s._id), s]));

  const allRaw = students.flatMap((s) => s.groups.flatMap((g) => g.payments || []));
  const nameOf = await collectorNames(allRaw);

  for (const child of tree) {
    const student = studentMap.get(String(child.student._id));
    for (const c of child.centers) {
      if (!c.linked) continue;
      for (const g of c.groups) {
        if (g.debt > 0)
          debts.push({
            student: { _id: child.student._id, fullName: child.student.fullName, photo: child.student.photo || "" },
            centerName: c.center.name,
            groupName: g.name,
            entryId: g.entryId,
            debt: g.debt,
            nextDueDate: g.nextDueDate,
          });
        const entry = student?.groups?.id(g.entryId);
        for (const p of entry?.payments || []) {
          if (p.status !== "paid") continue;
          const month = moment.unix(p.date).tz(TZ).format("YYYY-MM");
          if (!monthMap.has(month)) monthMap.set(month, []);
          monthMap.get(month).push({
            student: { _id: child.student._id, fullName: child.student.fullName, photo: child.student.photo || "" },
            centerName: c.center.name,
            groupName: g.name,
            entryId: g.entryId,
            amount: p.amount,
            type: p.type,
            date: p.date,
            code: p.code || null,
            collectedByName: nameOf(p),
          });
        }
      }
    }
  }
  const months = [...monthMap.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([month, items]) => ({ month, items: items.sort((a, b) => b.date - a.date) }));
  return { totalDebt: debts.reduce((s, d) => s + d.debt, 0), debts, months };
};

// GET /parent/notifications?page=&type= (§4.8)
// Rol almashtirilganda eski rolning xabarlari ko'rinmasin (o'quvchiga eski
// qarz/to'lov xabarlari chiqmasin) — ro'yxat parentNotification TYPE_ROLES bilan mos.
const ROLE_NOTIF_TYPES = {
  parent: ["attendance", "payment", "lessonFinished", "homeworkMissed", "debt", "badge", "coin"],
  student: ["lessonFinished", "homework", "homeworkMissed", "lessonReminder", "badge", "coin", "shop"],
};
const notifications = async (parent, { page = 1, type = "" } = {}) => {
  const pageNum = Math.max(1, Number(page) || 1);
  const allowed = ROLE_NOTIF_TYPES[await effectiveRole(parent)] || ROLE_NOTIF_TYPES.parent;
  const roleFilter = { "recipient.id": parent._id, type: { $in: allowed.map((x) => `parent:${x}`) } };
  const filter = { ...roleFilter };
  // WebApp filtri to'liq nom (`parent:badge`) yuboradi — prefiks bilan ham, siz ham qabul.
  const wanted = String(type || "").replace(/^parent:/, "");
  if (wanted && allowed.includes(wanted)) filter.type = `parent:${wanted}`;
  const [data, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip((pageNum - 1) * NOTIF_PAGE_SIZE).limit(NOTIF_PAGE_SIZE).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ ...roleFilter, read: false }),
  ]);
  return {
    data: data.map((n) => ({
      _id: String(n._id),
      type: n.type,
      title: n.title,
      body: n.body || "",
      data: n.data || {},
      read: !!n.read,
      createdAt: n.createdAt,
    })),
    meta: { page: pageNum, limit: NOTIF_PAGE_SIZE, total, totalPages: Math.ceil(total / NOTIF_PAGE_SIZE) || 1, unread },
  };
};

const readAllNotifications = async (parent) => {
  await Notification.updateMany({ "recipient.id": parent._id, read: false }, { $set: { read: true, readAt: getNow() } });
  return { ok: true };
};

// PATCH /parent/settings (§4.9) — yagona yozuv.
const updateSettings = async (parent, { lang, mute } = {}) => {
  if (lang !== undefined) {
    if (!LANGS.includes(lang)) throw new Error("parent.invalidLang");
    parent.telegram.lang = lang;
  }
  if (mute !== undefined) {
    if (!mute || typeof mute !== "object") throw new Error("parent.invalidSettings");
    // O'quvchi roli uchun `debt`/`payment` e'tiborsiz (§3.4): qarz xabari unga
    // yuborilmaydi, to'lov esa faqat PDF chek sifatida keladi va o'chirilmaydi
    // (API_CONTRACT_receipt_pdf.md §2).
    const ignored = (await effectiveRole(parent)) === "student" ? STUDENT_IGNORED_MUTE : [];
    for (const k of MUTE_KEYS) {
      if (mute[k] === undefined || ignored.includes(k)) continue;
      if (typeof mute[k] !== "boolean") throw new Error("parent.invalidSettings");
      parent.mute[k] = mute[k];
    }
  }
  await parent.save();
  return await me(parent);
};

// GET /parent/entries/:entryId/rank (§3.5) — guruhdagi o'rin. Hisob
// `attendance.service.getStudentsSummary` bilan bir xil (gradeScore.util).
// Boshqa o'quvchilarning ism/ballari QAYTMAYDI.
const entryRank = async (parent, entryId) => {
  const { student, group, center } = await resolveEntry(parent, entryId);
  // Reyting JORIY OY bo'yicha (API_CONTRACT_badges_monthly_rank.md §A) —
  // UI "Sentabr reytingi" yozuvi uchun `month` javobda qaytadi.
  const month = moment.tz(TZ).format("YYYY-MM");
  const summary = await groupStudentsSummary(group, { month });
  // Individual (1 kishilik) guruhda o'rin ma'nosiz — doim "1/1" chiqardi
  // (API_CONTRACT_individual_students.md §0.6). O'rin berilmaydi, lekin
  // o'quvchining o'z baho/davomat ko'rsatkichlari (kartalar shundan oladi) qoladi.
  const individual = group.kind === "individual";
  const { total, ranked, position } = individual
    ? { total: 1, ranked: 0, position: null }
    : rankInSummary(summary, student._id);
  const own = summary[String(student._id)] || null;
  // Markaz baholarni yashirgan bo'lsa (entryGrades bilan bir xil qoida) —
  // o'rin ham bahodan kelib chiqadi, shuning uchun u ham berilmaydi.
  if (center.parentNotifications?.showGrades === false) {
    return {
      month,
      total,
      position: null,
      ranked: 0,
      gradeAverage: null,
      gradeCount: 0,
      gradeScore: null,
      attendanceRate: own?.attendanceRate ?? 0,
      gradesHidden: true,
      individual,
    };
  }
  return {
    month,
    total,
    position,
    ranked,
    gradeAverage: own?.gradeAverage ?? null,
    gradeCount: own?.gradeCount ?? 0,
    gradeScore: own?.gradeScore ?? null,
    attendanceRate: own?.attendanceRate ?? 0,
    individual,
  };
};

// GET /parent/entries/:entryId/badges (API_CONTRACT_badges_monthly_rank.md §C)
// — olingan yutuq nishonlari + joriy oy progressi. Tarifda flag o'chiq
// bo'lsa faqat `{ enabled: false }` (UI tabni yashiradi). Markaz baholarni
// yashirgan bo'lsa baho nishonlari chiqariladi (entryGrades bilan bir xil qoida).
const entryBadges = async (parent, entryId) => {
  const { student, entry, group, center } = await resolveEntry(parent, entryId);
  // client.service → ... aylanma import bo'lmasin — chaqiruv paytida olinadi.
  const clientService = require("./client.service");
  if (!(await clientService.hasPermission(entry.client, BADGE_FEATURE))) return { enabled: false };

  const { month, earned, medals, progress } = await require("./badge.service").entryBadges(group, student._id);
  const gradesHidden = center.parentNotifications?.showGrades === false;
  if (!gradesHidden) return { enabled: true, month, earned, medals, progress, gradesHidden: false };
  // Reyting baholarga asoslangan — markaz baholarni yashirsa medallar ham yo'q.
  return {
    enabled: true,
    month,
    earned: earned.filter((b) => !GRADE_BADGES.includes(b.type)),
    medals: [],
    progress: Object.fromEntries(Object.entries(progress).filter(([type]) => !GRADE_BADGES.includes(type))),
    gradesHidden: true,
  };
};

// GET /parent/entries/:entryId/homework?month= (§3.6) — faqat a'zolik
// oynasidagi (joinedAt..leftAt) sanalar; kelajakdagi sanalar ham ko'rinadi.
const entryHomework = async (parent, entryId, monthRaw) => {
  const { entry, student } = await resolveEntry(parent, entryId);
  const month = normalizeMonth(monthRaw);
  const toDay = (unix) => (unix ? moment.unix(unix).tz(TZ).format("YYYY-MM-DD") : null);
  const from = toDay(entry.joinedAt);
  const until = entry.status !== "active" ? toDay(entry.leftAt) : null;

  const date = { $gte: `${month}-01`, $lte: `${month}-31` };
  if (from && from > date.$gte) date.$gte = from;
  if (until && until < date.$lte) date.$lte = until;

  const items = date.$gte > date.$lte
    ? []
    : await Homework.find({ group: entry.group, isDeleted: false, date })
        .select("date text updatedAt results")
        .sort({ date: -1 })
        .lean();
  // O'quvchining o'z natijasi (API_CONTRACT_wecoin.md §2.3) — boshqalarniki chiqmaydi.
  const sid = String(student._id);
  const statusOf = (h) => (h.results || []).find((r) => String(r.student) === sid)?.status || null;
  return {
    month,
    items: items.map((h) => ({ date: h.date, text: h.text, updatedAt: h.updatedAt, status: statusOf(h) })),
  };
};

// GET /parent/entries/:entryId/lesson-plan (API_CONTRACT_parent_lesson_plan.md)
// — o'quvchi va ota-ona uchun "Dars rejasi": o'tilgan mavzular (faqat
// a'zolik oynasidagi davomat kunlari), bugungi dars va keyingi darslar.
// Dam olish kunlari ham ro'yxatda turadi — mavzu nega keyingi kunga
// surilganini ko'rsatish uchun. Sana→dars moslashuvi o'qituvchi panelidagi
// bilan AYNAN bir xil (utils/lessonSchedule.util.js).
const LESSON_PLAN_FEATURE = "lesson.planning";
const UPCOMING_LESSONS = 8;
const PAST_LESSONS = 12;

const planLessonDTO = (lesson) =>
  lesson
    ? { no: lesson.no, title: lesson.title, moduleTitle: lesson.moduleTitle, description: lesson.description || "" }
    : null;

const entryLessonPlan = async (parent, entryId) => {
  const { entry, group } = await resolveEntry(parent, entryId);
  const clientService = require("./client.service");
  if (!(await clientService.hasPermission(entry.client, LESSON_PLAN_FEATURE))) return { enabled: false };

  const { getGroupSchedule, JS_DAY_TO_CODE } = require("../utils/lessonSchedule.util");
  const schedule = await getGroupSchedule(group, { horizonDays: 120 });
  if (!schedule.lessons.length) return { enabled: true, hasPlan: false };

  const { lessonByDate, holidayNotes, today, progress } = schedule;
  const toDay = (unix) => (unix ? moment.unix(unix).tz(TZ).format("YYYY-MM-DD") : null);
  const from = toDay(entry.joinedAt) || "0000-00-00";
  const until = entry.status !== "active" ? toDay(entry.leftAt) : null;
  const finishKey = group.finishedAt ? toDay(group.finishedAt) : null;
  const inMembership = (date) => date >= from && (!until || date <= until);
  const isLessonWeekday = (date) =>
    (group.days || []).includes(JS_DAY_TO_CODE[moment.tz(date, "YYYY-MM-DD", TZ).day()]);

  const past = schedule.attendanceDates
    .filter((date) => date < today && inMembership(date) && lessonByDate[date])
    .reverse()
    .slice(0, PAST_LESSONS)
    .map((date) => ({ date, lesson: planLessonDTO(lessonByDate[date]) }));

  let todayItem = null;
  if (lessonByDate[today] !== undefined && inMembership(today)) {
    todayItem = { date: today, type: "lesson", lesson: planLessonDTO(lessonByDate[today]) };
  } else if (holidayNotes[today] !== undefined && isLessonWeekday(today)) {
    todayItem = { date: today, type: "holiday", note: holidayNotes[today] };
  }

  // Keyingi darslar + oradagi dam olish kunlari (faqat guruh dars kunlariga
  // to'g'ri kelganlari — boshqa kunlardagi bayram darsni surmaydi).
  const upcoming = [];
  if (!until) {
    const dates = [
      ...Object.keys(lessonByDate).filter((d) => d > today),
      ...Object.keys(holidayNotes).filter((d) => d > today && isLessonWeekday(d) && (!finishKey || d <= finishKey)),
    ].sort();
    let lessonCount = 0;
    for (const date of dates) {
      if (lessonCount >= UPCOMING_LESSONS) break;
      if (lessonByDate[date] !== undefined) {
        upcoming.push({ date, type: "lesson", lesson: planLessonDTO(lessonByDate[date]) });
        lessonCount += 1;
      } else {
        upcoming.push({ date, type: "holiday", note: holidayNotes[date] });
      }
    }
    // Oxirgi darsdan keyin qolgan dam olish kunlari ma'nosiz.
    while (upcoming.length && upcoming[upcoming.length - 1].type === "holiday") upcoming.pop();
  }

  const doneCount = progress.doneCount;
  const modules = schedule.modules.map((m) => ({ title: m.title, lessons: [] }));
  for (const l of schedule.lessons) {
    modules[l.moduleIndex].lessons.push({
      no: l.no,
      title: l.title,
      state: l.no <= doneCount ? "done" : l.no === progress.nextNo ? "current" : "upcoming",
    });
  }

  return {
    enabled: true,
    hasPlan: true,
    today,
    progress: {
      doneCount: Math.min(doneCount, progress.totalLessons),
      totalLessons: progress.totalLessons,
      nextNo: progress.nextNo,
      finished: progress.finished,
      moduleCount: progress.moduleCount,
      currentModuleIndex: progress.currentModuleIndex,
    },
    todayItem,
    upcoming,
    past,
    modules,
  };
};

// ---- QR karta (API_CONTRACT_parent_qr_card.md §1) ----
// Umumiy shart: entry ota-onaga tegishli (`resolveEntry`), a'zolik FAOL va
// o'sha mijoz tarifida `attendance.qr` bor. Aks holda `parent.qrUnavailable`
// (frontend tugmani yashiradi). Servislar circular require'dan qochish
// uchun lazy olinadi.
const qrCardContext = async (parent, entryId) => {
  const { student, entry, center } = await resolveEntry(parent, entryId);
  if (entry.status !== "active") throw new Error("parent.qrUnavailable");
  const features = await require("./client.service").getTariffFeatures(entry.client);
  if (!features.includes("attendance.qr")) throw new Error("parent.qrUnavailable");
  return { student, entry, center };
};

// GET /parent/entries/:entryId/qr-card — owner darajasidagi `getQrToken`
// (reset YO'Q), filial = shu a'zolik markazi (karta shu markaz nomi bilan).
const entryQrCard = async (parent, entryId) => {
  const { student, entry } = await qrCardContext(parent, entryId);
  const card = await require("./attendance.service").getQrToken(entry.client, student._id, false, entry.center);
  return {
    fullName: card.fullName,
    qrToken: card.qrToken,
    center: { name: card.center?.name || "", logo: card.center?.logo || null },
    groups: card.groups,
  };
};

// POST /parent/entries/:entryId/qr-card/send — mijozda chizilgan PNG faqat
// so'rovchining O'Z chatiga. Diskka yozilmaydi (`file.data` Buffer).
const sendEntryQrCard = async (parent, entryId, file) => {
  const attendanceService = require("./attendance.service");
  const { student, center } = await qrCardContext(parent, entryId);
  const buffer = attendanceService.assertPngCard(file);
  const chatId = parent.telegram?.chatId;
  if (!chatId) throw new Error("parent.qrSendFailed");

  const redis = require("../configs/redis.config");
  const lockKey = require("../configs/key.config").parentQrCardSend(parent._id, entryId);
  const locked = await redis.set(lockKey, "1", "EX", attendanceService.QR_SEND_LOCK_SEC, "NX");
  if (!locked) throw new Error("parent.qrSendTooSoon");

  const botNotify = require("../bot/notify");
  const { t: botT } = require("../bot/i18n");
  const vars = { name: botNotify.escapeHtml(student.fullName || ""), center: botNotify.escapeHtml(center?.name || "") };
  const caption = attendanceService.fillCaption(botT(parent.telegram?.lang || "uz", "qrCardCaptionSelf"), vars);
  const res = await botNotify.sendPhotoToChat(chatId, buffer, `qr-${String(student._id)}.png`, { caption });
  await require("./parentNotification.service").markBlockedIfNeeded(parent, res);
  if (!res.ok) {
    console.error("parent sendEntryQrCard:", res.error);
    // Ketmadi — qayta urinish 15 soniya kutmasin.
    await redis.del(lockKey);
    throw new Error("parent.qrSendFailed");
  }
};

// ---------------------------------------------------------------------------
// WECOIN va filial do'koni (API_CONTRACT_wecoin.md §4). Hisob/xarid mantiqi
// coin/shop servislarida — bu yerda faqat rolga mos o'quvchilar va rol cheklovi.
// ---------------------------------------------------------------------------

const coinPair = async (parent, studentId, centerId) => {
  const coinService = require("./coin.service");
  const students = await findStudentsOf(parent);
  return await coinService.assertParentPair(students, studentId, centerId);
};

const coins = async (parent) => {
  const coinService = require("./coin.service");
  const role = await effectiveRole(parent);
  const students = await findStudentsOf(parent, role);
  return { role, wallets: await coinService.parentWallets(students) };
};

const coinShop = async (parent, studentId, centerId) => {
  const shopService = require("./shop.service");
  return await shopService.shopFor(await coinPair(parent, studentId, centerId), centerId);
};

// Sotib olish — faqat o'quvchining o'zi (ota-ona faqat ko'radi).
const coinBuy = async (parent, studentId, centerId, productId) => {
  if ((await effectiveRole(parent)) !== "student") throw new Error("shop.studentOnly");
  const shopService = require("./shop.service");
  return await shopService.buy(await coinPair(parent, studentId, centerId), centerId, productId);
};

const coinLike = async (parent, studentId, centerId, productId) => {
  if ((await effectiveRole(parent)) !== "student") throw new Error("shop.studentOnly");
  const shopService = require("./shop.service");
  return await shopService.toggleLike(await coinPair(parent, studentId, centerId), centerId, productId);
};

const coinHistory = async (parent, studentId, centerId) => {
  const shopService = require("./shop.service");
  return await shopService.history(await coinPair(parent, studentId, centerId), centerId);
};

module.exports = {
  ROLES,
  roleMatch,
  availableRoles,
  rolesList,
  effectiveRole,
  setRole,
  findStudentsOf,
  findChildren,
  isStaffChat,
  findByChat,
  linkByContact,
  setLang,
  unlink,
  unblock,
  // WebApp API
  ParentDTO,
  verifyInitData,
  authTelegram,
  me,
  children,
  entryAttendance,
  entryLessonPlan,
  entryGrades,
  entryPayments,
  allPayments,
  notifications,
  readAllNotifications,
  updateSettings,
  updateRole,
  entryRank,
  entryHomework,
  entryBadges,
  entryQrCard,
  sendEntryQrCard,
  coins,
  coinShop,
  coinBuy,
  coinLike,
  coinHistory,
};
