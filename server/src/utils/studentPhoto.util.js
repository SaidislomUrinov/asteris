// O'quvchi rasmi o'quv markaz (Client) darajasida
// (API_CONTRACT_student_photo_per_client.md). `Student.photos[]` — har client
// uchun ko'pi bilan bitta element `{ client, path, updatedAt }`. Sof
// funksiyalar: mongoose hujjati yoki `.lean()` obyekti bilan ishlaydi.

const photosOf = (student) => (Array.isArray(student?.photos) ? student.photos : []);

/**
 * Shu client'ning rasmi (yo'q bo'lsa "").
 * @param {object} student
 * @param {string|import("mongoose").Types.ObjectId} clientId
 * @returns {string}
 */
const photoFor = (student, clientId) => {
  if (!clientId) return "";
  const key = String(clientId);
  const item = photosOf(student).find((p) => p && String(p.client) === key);
  return item?.path || "";
};

/**
 * `updatedAt` bo'yicha eng so'nggi rasm (yo'q bo'lsa "") — boshqa client
 * o'quvchisini tanlash/qo'shishda ishlatiladi.
 * @param {object} student
 * @returns {string}
 */
const latestPhoto = (student) => {
  let best = null;
  for (const p of photosOf(student)) {
    if (!p?.path) continue;
    if (!best || (p.updatedAt || 0) > (best.updatedAt || 0)) best = p;
  }
  return best?.path || "";
};

module.exports = { photoFor, latestPhoto };
