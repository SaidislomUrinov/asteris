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
};
