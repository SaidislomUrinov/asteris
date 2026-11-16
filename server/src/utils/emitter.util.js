const { getIo } = require("../configs/socket.config");
const dashboardCache = require("./dashboardCache.util");
const reportCache = require("./reportCache.util");

// Dashboard raqamlarini o'zgartiradigan hodisalar. Invalidatsiya aynan shu
// yerda — barcha shu hodisalar SHU funksiya orqali o'tadi, shuning uchun
// yangi chaqiruv joyi qo'shilganda keshni bekor qilishni unutib bo'lmaydi
// (API_CONTRACT_performance.md §3). Servislarga tarqatib yozilsa ertami-kech
// bittasi esdan chiqib, foydalanuvchi eskirgan raqam ko'rardi.
const CACHE_BUSTING = new Set([
  "payment:created",
  "payment:cancelled",
  // To'lov boshqa oyga o'tkazildi — oylik tushum/qarzdorlik o'zgaradi
  // (API_CONTRACT_payment_move_month.md).
  "payment:updated",
  "student:leftGroup",
  "attendance:marked",
  "expense:created",
  "expense:updated",
  "salary:updated",
  // Arxivlash/qaytarish qarzdorlik va o'quvchi/guruh sanoqlarini darhol
  // o'zgartiradi (API_CONTRACT_archive.md §3) — kesh bekor qilinmasa
  // Dashboard eski raqamni ko'rsatib qolardi.
  "archive:changed",
  // Narx yoki ko'chirishdan oldingi qarz o'zgarishi qarzdorlikni darhol
  // o'zgartiradi (API_CONTRACT_opening_debts.md §3.2 shu eventni ishlatadi).
  "student:priceUpdated",
]);

/**
 * @param {string} to - "client:{id}" | "center:{id}" | "user:{id}" | socket.id (bitta ulanishga)
 * @param {string} action - masalan "payment:created"
 * @param {*} payload
 */
module.exports = (to, action = "", payload) => {
  // Socket hali ko'tarilmagan bo'lsa (masalan fon ishlari serverdan alohida
  // ishga tushirilganda) emit o'tkazib yuboriladi — ma'lumot bazaga baribir
  // yozilgan bo'ladi, realtime xabar esa shunchaki bormaydi. Aks holda
  // butun amal xato bilan uzilardi.
  let io;
  try {
    io = getIo();
  } catch {
    io = null;
  }

  if (CACHE_BUSTING.has(action) && typeof to === "string" && to.startsWith("client:")) {
    const clientId = to.slice("client:".length);
    // Fire-and-forget: kesh tozalash socket yuborishni kutib turmasligi kerak.
    // dashboardCache.invalidate() xatoni o'zi ichida yutadi.
    void dashboardCache.invalidate(clientId);
    // Hisobotlar ham AYNAN shu hodisalardan eskiradi — bir joyda tozalash
    // servislarga tarqatib yozishdan ishonchliroq (yangi chaqiruv qo'shilganda
    // unutib bo'lmaydi).
    void reportCache.invalidate(clientId);
  }

  if (!io) return;

  if (!to) {
    io.emit(action, payload);
    return;
  }

  io.to(to).emit(action, payload);

  // `client:{id}` xonasida endi FAQAT Owner bor (socket.config.js). Hodimlarga
  // xuddi shu hodisa ularning FILIAL xonasi orqali yetkaziladi — avval barcha
  // hodimlar `client:` xonasida bo'lib, boshqa filial va moliya/audit
  // hodisalarini ham olardi (QA 2026-10-02).
  if (
    typeof to === "string" &&
    to.startsWith("client:") &&
    !OWNER_ONLY.has(action) &&
    !CALLER_ROUTES_CENTER.has(action)
  ) {
    void forwardToStaff(io, to.slice("client:".length), action, payload);
  }
};

// Faqat Owner ko'radigan hodisalar — hodim xonalariga umuman yuborilmaydi
// (audit jurnali faqat Owner'niki, `audit:view` hodimga berilmaydi).
const OWNER_ONLY = new Set(["audit:created"]);

// Xarajat hodisalari (summalar bilan) — filialning faqat `expense:view`
// ruxsatli hodimlariga (`center:{id}:expense`, socket.config.js).
const EXPENSE_EVENTS = new Set(["expense:created", "expense:updated"]);

// Bu hodisalarni chaqiruvchi servis `center:{id}` xonasiga O'ZI ham yuboradi
// (masalan bir o'quvchi bir nechta filialda bo'lganda) — qayta yo'naltirilsa
// hodim ikki marta olardi.
const CALLER_ROUTES_CENTER = new Set([
  "student:updated",
  "student:enrolled",
  "student:importUndone",
  "student:priceUpdated",
  "payment:updated",
  "lead:changed",
  "archive:changed",
  // Uyga vazifa va WECOIN — servis `center:` + `client:` ga o'zi yuboradi
  // (Owner `center:` xonasida emas, socket.config.js).
  "homework:updated",
  "homework:results",
  // Test (Quiz) moduli — servis/job `toCenter` bilan yuboradi (API_CONTRACT_quiz.md).
  "quiz:sent",
  "quiz:started",
  "quiz:finished",
  "quiz:attempt_updated",
  "coin:settings",
  "coin:distributed",
  "coin:adjusted",
  "shop:order",
  "shop:orderUpdated",
  "shop:products",
  // SMS balans filial darajasida — servis `toCenter` bilan yuboradi.
  "sms:balance",
  "sms:credited",
  "sms:batch",
]);

// Filial hodisasini ham hodimlarga (`center:`), ham Owner'ga (`client:`)
// yuboradi. Hodisa CALLER_ROUTES_CENTER'da bo'lishi shart — aks holda hodim
// ikki marta oladi.
module.exports.toCenter = (clientId, centerId, action, payload) => {
  module.exports(`center:${centerId}`, action, payload);
  module.exports(`client:${clientId}`, action, payload);
};

// Filialga bog'lanmagan, maxfiy bo'lmagan tenant hodisalari — tenantning
// barcha hodimlariga (`staff:{clientId}` xonasi).
const TENANT_WIDE = new Set(["subscription:updated", "center:statusChanged"]);

// groupId/staffId → centerId. Guruh yoki hodim filiali deyarli o'zgarmaydi;
// kichik xotira keshi har hodisada bazaga borishning oldini oladi.
const CENTER_CACHE = new Map();
const CENTER_CACHE_TTL = 5 * 60 * 1000;
const CENTER_CACHE_MAX = 2000;

const cachedCenter = async (kind, id) => {
  const key = `${kind}:${id}`;
  const hit = CENTER_CACHE.get(key);
  if (hit && hit.at > Date.now() - CENTER_CACHE_TTL) return hit.center;
  const Model = require(kind === "group" ? "../models/Group" : "../models/Staff");
  const doc = await Model.findById(id).select("center").lean();
  const center = doc?.center ? String(doc.center) : null;
  if (CENTER_CACHE.size >= CENTER_CACHE_MAX) CENTER_CACHE.delete(CENTER_CACHE.keys().next().value);
  CENTER_CACHE.set(key, { center, at: Date.now() });
  return center;
};

const isId = (v) => typeof v === "string" || (v && typeof v === "object" && typeof v.toString === "function");

const forwardToStaff = async (io, clientId, action, payload) => {
  try {
    if (TENANT_WIDE.has(action)) {
      io.to(`staff:${clientId}`).emit(action, payload);
      return;
    }
    const p = payload || {};
    // DTO'da `center` populate qilingan obyekt bo'lishi mumkin.
    let center = p.center?._id || p.center || p.centerId || null;
    const groupId = p.groupId || p.group;
    if (!center && groupId && isId(groupId)) center = await cachedCenter("group", String(groupId));
    if (!center && p.staff && isId(p.staff)) {
      // Oylik o'zgarishi — hodimning o'ziga ham (TeacherHome jonli yangilanadi).
      io.to(`user:${String(p.staff)}`).emit(action, payload);
      center = await cachedCenter("staff", String(p.staff));
    }
    if (!center) return;
    const room = EXPENSE_EVENTS.has(action) ? `center:${String(center)}:expense` : `center:${String(center)}`;
    io.to(room).emit(action, payload);
  } catch {
    // realtime yetkazish — asosiy amalni buzmasin
  }
};
