// WECOIN — filial darajasidagi tanga (API_CONTRACT_wecoin.md §1–§5).
// Qoidalar (CoinSetting), oylik hisob, oy yakunida tarqatish va balanslar.
// Do'kon (mahsulot/buyurtma) — `shop.service.js`.
const moment = require("moment-timezone");
const { isValidObjectId } = require("mongoose");
const CoinSetting = require("../models/CoinSetting");
const CoinWallet = require("../models/CoinWallet");
const CoinTransaction = require("../models/CoinTransaction");
const Center = require("../models/Center");
const Group = require("../models/Group");
const Student = require("../models/Student");
const Grade = require("../models/Grade");
const Homework = require("../models/Homework");
const Attendance = require("../models/Attendance");
const StudentMedal = require("../models/StudentMedal");
const ShopOrder = require("../models/ShopOrder");
const clientService = require("./client.service");
const emit = require("../utils/emitter.util");
const { log: auditLog } = require("../utils/audit.util");
const { photoFor } = require("../utils/studentPhoto.util");
const { COIN_MAX } = require("../models/CoinSetting");
const { getNow } = require("../utils/date.util");

const TZ = "Asia/Tashkent";
const FEATURE = "gamification.coins";
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const PARTS = ["grades", "homework", "attendance", "medals"];
const PAGE_SIZE = 30;

const currentMonth = () => moment.tz(TZ).format("YYYY-MM");
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ---------------------------------------------------------------------------
// QOIDALAR
// ---------------------------------------------------------------------------

const emptyRules = () => ({
  grades: [],
  homework: { done: 0, partial: 0 },
  attendance: { present: 0 },
  medals: { gold: 0, silver: 0, bronze: 0 },
});

const rulesDTO = (rules) => {
  const r = rules || {};
  return {
    grades: (r.grades || [])
      .filter((g) => g.coins > 0)
      .map((g) => ({ value: g.value, coins: g.coins }))
      .sort((a, b) => b.value - a.value),
    homework: { done: r.homework?.done || 0, partial: r.homework?.partial || 0 },
    attendance: { present: r.attendance?.present || 0 },
    medals: { gold: r.medals?.gold || 0, silver: r.medals?.silver || 0, bronze: r.medals?.bronze || 0 },
  };
};

const settingDTO = (doc, centerId) => ({
  centerId: String(doc?.center || centerId),
  enabled: !!doc?.enabled,
  rules: rulesDTO(doc?.rules || emptyRules()),
  updatedAt: doc?.updatedAt || null,
});

// Butun son 0..COIN_MAX — aks holda `coin.invalidRules`.
const coinOf = (v) => {
  if (v === undefined || v === null || v === "") return 0;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > COIN_MAX) throw new Error("coin.invalidRules");
  return n;
};

const parseRules = (raw) => {
  if (!raw || typeof raw !== "object") throw new Error("coin.invalidRules");
  const grades = new Map();
  for (const g of Array.isArray(raw.grades) ? raw.grades : []) {
    const value = Number(g?.value);
    if (!Number.isInteger(value) || value < 1 || value > 10) throw new Error("coin.invalidRules");
    const coins = coinOf(g?.coins);
    if (coins > 0) grades.set(value, coins);
  }
  return {
    grades: [...grades].map(([value, coins]) => ({ value, coins })).sort((a, b) => b.value - a.value),
    homework: { done: coinOf(raw.homework?.done), partial: coinOf(raw.homework?.partial) },
    attendance: { present: coinOf(raw.attendance?.present) },
    medals: { gold: coinOf(raw.medals?.gold), silver: coinOf(raw.medals?.silver), bronze: coinOf(raw.medals?.bronze) },
  };
};

const assertCenter = async (clientId, centerId) => {
  if (!isValidObjectId(centerId)) throw new Error("center.notFound");
  const center = await Center.findOne({ _id: centerId, client: clientId, isDeleted: false }).select("name status").lean();
  if (!center) throw new Error("center.notFound");
  return center;
};

// Filialda WECOIN ishlayaptimi: sozlama yoqilgan + client tarifida flag bor.
// `featureCache` — bir so'rovda bir nechta filial bo'lsa tarif qayta o'qilmasin.
const activeSettingsFor = async (centerIds, featureCache = new Map()) => {
  const docs = await CoinSetting.find({ center: { $in: centerIds }, enabled: true }).lean();
  const out = new Map();
  for (const doc of docs) {
    const key = String(doc.client);
    if (!featureCache.has(key)) featureCache.set(key, await clientService.hasPermission(doc.client, FEATURE));
    if (featureCache.get(key)) out.set(String(doc.center), doc);
  }
  return out;
};

// ---------------------------------------------------------------------------
// INDIVIDUAL — WECOIN o'chiq individual guruhlar (API_CONTRACT_individual_coins.md §4).
// Ularning yozuvlari tanga bermaydi; faqat shunday a'zoligi bor o'quvchiga
// filialda WECOIN (hamyon/do'kon) ko'rsatilmaydi.
// ---------------------------------------------------------------------------

const NO_COIN_FILTER = { kind: "individual", coinsEnabled: { $ne: true } };

const noCoinGroupIds = async (centerIds) =>
  await Group.find({ center: { $in: [].concat(centerIds) }, ...NO_COIN_FILTER }).distinct("_id");

// a'zolik (Student.groups[] entry) WECOIN beradimi: faol + o'chiq individual emas.
const coinEntry = (g, blocked) => g.status === "active" && !blocked.has(String(g.group));

// ---------------------------------------------------------------------------
// OYLIK HISOB — filial bo'yicha, bitta oy. Qaytaradi Map<studentId, { total, breakdown }>.
// `studentIds` berilsa faqat shular (WebApp taxmini uchun).
// ---------------------------------------------------------------------------

const emptyBreakdown = () => Object.fromEntries(PARTS.map((p) => [p, { count: 0, coins: 0 }]));

const computeMonth = async (centerId, month, rules, studentIds = null) => {
  const r = rulesDTO(rules);
  const date = { $gte: `${month}-01`, $lte: `${month}-31` };
  const only = studentIds ? new Set(studentIds.map(String)) : null;
  const studentFilter = studentIds ? { student: { $in: studentIds } } : {};
  const gradeCoins = new Map(r.grades.map((g) => [g.value, g.coins]));
  const MEDAL_KEY = { 1: "gold", 2: "silver", 3: "bronze" };
  const blocked = await noCoinGroupIds(centerId);
  const groupFilter = blocked.length ? { group: { $nin: blocked } } : {};

  const [grades, homeworks, sessions, medals] = await Promise.all([
    gradeCoins.size
      ? Grade.find({ center: centerId, date, value: { $in: [...gradeCoins.keys()] }, ...groupFilter, ...studentFilter }).select("student value").lean()
      : [],
    r.homework.done || r.homework.partial
      ? Homework.find({ center: centerId, isDeleted: false, date, "results.0": { $exists: true }, ...groupFilter }).select("results").lean()
      : [],
    r.attendance.present
      ? Attendance.find({ center: centerId, date, ...groupFilter }).select("records.student records.status").lean()
      : [],
    r.medals.gold || r.medals.silver || r.medals.bronze
      ? StudentMedal.find({ center: centerId, month, ...groupFilter, ...studentFilter }).select("student position").lean()
      : [],
  ]);

  const out = new Map();
  const add = (studentId, part, coins) => {
    const id = String(studentId);
    if (only && !only.has(id)) return;
    if (!coins) return;
    if (!out.has(id)) out.set(id, { total: 0, breakdown: emptyBreakdown() });
    const row = out.get(id);
    row.breakdown[part].count += 1;
    row.breakdown[part].coins += coins;
    row.total += coins;
  };

  for (const g of grades) add(g.student, "grades", gradeCoins.get(g.value) || 0);
  for (const h of homeworks) {
    for (const res of h.results || []) add(res.student, "homework", r.homework[res.status] || 0);
  }
  for (const s of sessions) {
    for (const rec of s.records || []) if (rec.status === "present") add(rec.student, "attendance", r.attendance.present);
  }
  for (const m of medals) add(m.student, "medals", r.medals[MEDAL_KEY[m.position]] || 0);
  return out;
};

// ---------------------------------------------------------------------------
// OY YAKUNI — jobs/badges.job.js (medallar berilgandan keyin).
// ---------------------------------------------------------------------------

// Bitta o'quvchiga `earn` yozuvi + balans. Idempotent (unique index).
const creditMonth = async ({ clientId, centerId, studentId, month, total, breakdown }) => {
  try {
    await CoinTransaction.create({
      client: clientId,
      center: centerId,
      student: studentId,
      type: "earn",
      amount: total,
      month,
      breakdown,
    });
  } catch (error) {
    if (error?.code === 11000) return false; // allaqachon berilgan
    throw error;
  }
  await CoinWallet.updateOne(
    { student: studentId, center: centerId },
    { $inc: { balance: total, earned: total }, $set: { updatedAt: getNow() }, $setOnInsert: { client: clientId } },
    { upsert: true },
  );
  return true;
};

const distributeMonth = async (month) => {
  if (!MONTH_RE.test(month || "")) throw new Error("coin.invalidMonth");
  const report = { centers: 0, students: 0, coins: 0, skippedTariff: 0 };
  const featureCache = new Map();
  const settings = await CoinSetting.find({ enabled: true }).lean();

  for (const setting of settings) {
    const key = String(setting.client);
    if (!featureCache.has(key)) featureCache.set(key, await clientService.hasPermission(setting.client, FEATURE));
    if (!featureCache.get(key)) {
      report.skippedTariff++;
      continue;
    }
    const center = await Center.findOne({ _id: setting.center, isDeleted: false }).select("status").lean();
    if (!center || center.status === "blocked") continue;

    const rows = await computeMonth(setting.center, month, setting.rules);
    if (!rows.size) continue;
    const alive = await Student.find({ _id: { $in: [...rows.keys()] }, isDeleted: false }).select("_id").lean();
    report.centers++;
    for (const { _id } of alive) {
      const row = rows.get(String(_id));
      const credited = await creditMonth({
        clientId: setting.client,
        centerId: setting.center,
        studentId: _id,
        month,
        total: row.total,
        breakdown: row.breakdown,
      });
      if (credited) {
        report.students++;
        report.coins += row.total;
      }
    }
    emit.toCenter(setting.client, setting.center, "coin:distributed", { centerId: String(setting.center), month });
  }
  return report;
};

// Oy yakuni xabari — `notified: false` earn yozuvlari bo'yicha (kunduzgi oyna).
const notifyMonth = async (month) => {
  const parentNotification = require("./parentNotification.service");
  const txs = await CoinTransaction.find({ type: "earn", month, notified: { $ne: true } }).lean();
  let sent = 0;
  for (const tx of txs) {
    const student = await Student.findById(tx.student);
    const entry =
      student?.groups?.find((g) => String(g.center) === String(tx.center) && g.status === "active") ||
      student?.groups?.find((g) => String(g.center) === String(tx.center));
    if (student && entry) {
      const wallet = await CoinWallet.findOne({ student: tx.student, center: tx.center }).select("balance").lean();
      await parentNotification.onCoins({ student, entry, month, amount: tx.amount, balance: wallet?.balance || 0 });
      sent++;
    }
    await CoinTransaction.updateOne({ _id: tx._id }, { $set: { notified: true } });
  }
  return { sent, total: txs.length };
};

// ---------------------------------------------------------------------------
// XODIM ENDPOINTLARI
// ---------------------------------------------------------------------------

const getSettings = async (clientId, centerId) => {
  await assertCenter(clientId, centerId);
  const doc = await CoinSetting.findOne({ client: clientId, center: centerId }).lean();
  return settingDTO(doc, centerId);
};

const updateSettings = async (clientId, centerId, body, actor) => {
  const center = await assertCenter(clientId, centerId);
  const rules = parseRules(body?.rules);
  const enabled = !!body?.enabled;
  const prev = await CoinSetting.findOne({ client: clientId, center: centerId }).lean();
  const doc = await CoinSetting.findOneAndUpdate(
    { client: clientId, center: centerId },
    {
      $set: {
        enabled,
        rules,
        updatedBy: { id: actor?.id || null, kind: actor?.kind === "staff" ? "staff" : "client" },
        updatedAt: getNow(),
      },
      $setOnInsert: { client: clientId, center: centerId },
    },
    { upsert: true, returnDocument: "after" },
  ).lean();

  await auditLog({
    actor,
    client: clientId,
    center: centerId,
    action: "coin:settings",
    entity: { type: "CoinSetting", id: doc._id, label: center.name },
    changes: [
      { field: "enabled", from: !!prev?.enabled, to: enabled },
      { field: "rules", from: prev ? rulesDTO(prev.rules) : null, to: rulesDTO(rules) },
    ],
  });
  emit.toCenter(clientId, centerId, "coin:settings", { centerId: String(centerId) });
  return settingDTO(doc, centerId);
};

// GET /coins/active-centers — WECOIN yoqilgan filiallar (individual switch
// ko'rinishi uchun, API_CONTRACT_individual_coins.md §3). Hodim — o'z filiali.
const activeCenters = async (clientId, centerScope = null) => {
  const filter = { client: clientId, enabled: true };
  if (centerScope) filter.center = centerScope;
  const docs = await CoinSetting.find(filter).select("center").lean();
  return { centers: docs.map((d) => String(d.center)) };
};

// GET /coins/:centerId/students — filialdagi faol o'quvchilar balansi + joriy oy taxmini.
const students = async (clientId, centerId, { search = "", page = 1 } = {}) => {
  await assertCenter(clientId, centerId);
  const filter = {
    isDeleted: false,
    groups: { $elemMatch: { client: clientId, center: centerId, status: "active" } },
  };
  const q = String(search || "").trim();
  if (q) filter.fullName = { $regex: escapeRegex(q).slice(0, 60), $options: "i" };
  const blocked = new Set((await noCoinGroupIds(centerId)).map(String));
  const list = (await Student.find(filter).select("fullName photos groups.group groups.center groups.status").lean()).filter(
    (s) => s.groups.some((g) => String(g.center) === String(centerId) && coinEntry(g, blocked)),
  );
  const ids = list.map((s) => s._id);

  const [wallets, setting] = await Promise.all([
    CoinWallet.find({ center: centerId, student: { $in: ids } }).lean(),
    CoinSetting.findOne({ client: clientId, center: centerId }).lean(),
  ]);
  const month = currentMonth();
  const projected = setting ? await computeMonth(centerId, month, setting.rules) : new Map();
  const walletOf = new Map(wallets.map((w) => [String(w.student), w]));

  const rows = list
    .map((s) => {
      const w = walletOf.get(String(s._id));
      return {
        student: { _id: String(s._id), fullName: s.fullName, photo: photoFor(s, clientId) },
        balance: w?.balance || 0,
        earned: w?.earned || 0,
        spent: w?.spent || 0,
        month: projected.get(String(s._id))?.total || 0,
      };
    })
    .sort((a, b) => b.balance - a.balance || b.month - a.month || a.student.fullName.localeCompare(b.student.fullName));

  const pageNum = Math.max(1, Number(page) || 1);
  const total = rows.length;
  return {
    data: rows.slice((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE),
    meta: { page: pageNum, limit: PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) },
    summary: {
      balance: rows.reduce((s, r) => s + r.balance, 0),
      month: rows.reduce((s, r) => s + r.month, 0),
    },
  };
};

// GET /coins/student/:studentId — o'quvchi detali: shu client filiallaridagi
// balanslar (+ joriy oy taxmini). Hodim — faqat o'z filiali (`centerScope`).
const studentWallets = async (clientId, studentId, centerScope = null) => {
  if (!isValidObjectId(studentId)) throw new Error("student.notFound");
  const student = await Student.findOne({ _id: studentId, isDeleted: false })
    .select("groups.client groups.center groups.group groups.status")
    .lean();
  if (!student) throw new Error("student.notFound");
  const own = (student.groups || []).filter((g) => String(g.client) === String(clientId));
  const blocked = new Set((await noCoinGroupIds([...new Set(own.map((g) => String(g.center)))])).map(String));
  // Faqat WECOIN o'chiq individual darsda o'qiydigan filial ko'rsatilmaydi.
  // Faol a'zoligi qolmagan (eski) filial esa avvalgidek — hamyoni bo'lsa ko'rinadi.
  let centerIds = [
    ...new Set(
      own
        .filter((g) => {
          const sameCenter = own.filter((x) => String(x.center) === String(g.center));
          const hasActive = sameCenter.some((x) => x.status === "active");
          return !hasActive || sameCenter.some((x) => coinEntry(x, blocked));
        })
        .map((g) => String(g.center)),
    ),
  ];
  if (centerScope) centerIds = centerIds.filter((c) => c === String(centerScope));
  if (!centerIds.length) return { balance: 0, month: 0, centers: [] };

  const [centers, wallets, settings] = await Promise.all([
    Center.find({ _id: { $in: centerIds }, client: clientId, isDeleted: false }).select("name").lean(),
    CoinWallet.find({ student: studentId, center: { $in: centerIds } }).lean(),
    CoinSetting.find({ client: clientId, center: { $in: centerIds } }).lean(),
  ]);
  const walletOf = new Map(wallets.map((w) => [String(w.center), w]));
  const settingOf = new Map(settings.map((s) => [String(s.center), s]));
  const month = currentMonth();
  const rows = [];
  for (const c of centers) {
    const key = String(c._id);
    const setting = settingOf.get(key);
    const w = walletOf.get(key);
    // WECOIN hech qachon ishlamagan filial ko'rsatilmaydi.
    if (!setting?.enabled && !w) continue;
    const projected = setting?.enabled
      ? (await computeMonth(key, month, setting.rules, [studentId])).get(String(studentId))?.total || 0
      : 0;
    rows.push({
      center: { _id: key, name: c.name },
      enabled: !!setting?.enabled,
      balance: w?.balance || 0,
      earned: w?.earned || 0,
      spent: w?.spent || 0,
      month: projected,
    });
  }
  return {
    balance: rows.reduce((s, r) => s + r.balance, 0),
    month: rows.reduce((s, r) => s + r.month, 0),
    centers: rows,
  };
};

// ---------------------------------------------------------------------------
// O'QUVCHI / OTA-ONA (parent.service orqali chaqiriladi, `students` —
// rolga mos, o'chirilmagan Student hujjatlari).
// ---------------------------------------------------------------------------

// Faol a'zolik bor va WECOIN yoqilgan (student, center) juftliklari.
const walletPairs = async (studentDocs) => {
  const centerIds = [
    ...new Set(studentDocs.flatMap((s) => (s.groups || []).filter((g) => g.status === "active").map((g) => String(g.center)))),
  ];
  if (!centerIds.length) return [];
  const blocked = new Set((await noCoinGroupIds(centerIds)).map(String));
  const pairs = [];
  for (const s of studentDocs) {
    const seen = new Set();
    for (const g of s.groups || []) {
      const k = String(g.center);
      if (!coinEntry(g, blocked) || seen.has(k)) continue;
      seen.add(k);
      pairs.push({ student: s, centerId: k, clientId: String(g.client) });
    }
  }
  if (!pairs.length) return [];
  const active = await activeSettingsFor([...new Set(pairs.map((p) => p.centerId))]);
  return pairs.filter((p) => active.has(p.centerId)).map((p) => ({ ...p, setting: active.get(p.centerId) }));
};

const parentWallets = async (studentDocs) => {
  const pairs = await walletPairs(studentDocs);
  if (!pairs.length) return [];
  const centerIds = [...new Set(pairs.map((p) => p.centerId))];
  const studentIds = [...new Set(pairs.map((p) => String(p.student._id)))];
  const [centers, wallets, pending] = await Promise.all([
    Center.find({ _id: { $in: centerIds }, isDeleted: false }).select("name").lean(),
    CoinWallet.find({ center: { $in: centerIds }, student: { $in: studentIds } }).lean(),
    ShopOrder.aggregate([
      { $match: { student: { $in: pairs.map((p) => p.student._id) }, status: "pending" } },
      { $group: { _id: { student: "$student", center: "$center" }, n: { $sum: 1 } } },
    ]),
  ]);
  const centerName = new Map(centers.map((c) => [String(c._id), c.name]));
  const walletOf = new Map(wallets.map((w) => [`${w.student}:${w.center}`, w]));
  const pendingOf = new Map(pending.map((p) => [`${p._id.student}:${p._id.center}`, p.n]));
  const month = currentMonth();

  const out = [];
  for (const p of pairs) {
    if (!centerName.has(p.centerId)) continue;
    const key = `${p.student._id}:${p.centerId}`;
    const w = walletOf.get(key);
    const row = (await computeMonth(p.centerId, month, p.setting.rules, [p.student._id])).get(String(p.student._id));
    out.push({
      student: { _id: String(p.student._id), fullName: p.student.fullName },
      center: { _id: p.centerId, name: centerName.get(p.centerId) },
      balance: w?.balance || 0,
      earned: w?.earned || 0,
      spent: w?.spent || 0,
      month: { month, total: row?.total || 0, breakdown: row?.breakdown || emptyBreakdown() },
      rules: rulesDTO(p.setting.rules),
      pendingOrders: pendingOf.get(key) || 0,
    });
  }
  return out;
};

// (student, center) juftligi WebApp uchun ochiqmi — do'kon/xarid/tarix oldidan.
// Qaytaradi { clientId, setting } yoki xato.
const assertParentPair = async (studentDocs, studentId, centerId) => {
  if (!isValidObjectId(studentId) || !isValidObjectId(centerId)) throw new Error("coin.notAvailable");
  const student = studentDocs.find((s) => String(s._id) === String(studentId));
  if (!student) throw new Error("coin.notAvailable");
  const pair = (await walletPairs([student])).find((p) => p.centerId === String(centerId));
  if (!pair) throw new Error("coin.notAvailable");
  return { student, clientId: pair.clientId, setting: pair.setting };
};

module.exports = {
  FEATURE,
  PARTS,
  rulesDTO,
  computeMonth,
  distributeMonth,
  notifyMonth,
  getSettings,
  updateSettings,
  activeCenters,
  students,
  studentWallets,
  parentWallets,
  assertParentPair,
};
