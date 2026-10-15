const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const md5 = require("md5");
const { getNow } = require("./date.util");
const { FOLDERS } = require("../configs/folder.config");

// Har bir folder uchun ruxsat etilgan fayl kengaytmalari — ixtiyoriy turdagi
// fayl (masalan .html/.svg) /uploads orqali static xizmat ko'rsatilishining
// oldini olish uchun.
const ALLOWED_EXTENSIONS = {
  [FOLDERS.LOGOS]: [".jpg", ".jpeg", ".png", ".webp"],
  [FOLDERS.CERTIFICATES]: [".jpg", ".jpeg", ".png", ".webp"],
  [FOLDERS.FONTS]: [".ttf", ".otf", ".woff", ".woff2"],
  [FOLDERS.CHAT_IMAGES]: [".jpg", ".jpeg", ".png", ".webp"],
  // Yangiliklar: rasm (≤10MB) + video (≤100MB) — hajm news.service'da tekshiriladi.
  [FOLDERS.NEWS]: [".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp4", ".webm"],
  // O'quvchi rasmi faqat server tomonda sharp bilan webp'ga aylantirilgan holda.
  [FOLDERS.STUDENTS]: [".webp"],
  [FOLDERS.SHOP]: [".webp"],
};

// Faqat `/uploads/<folder>/<fayl>` ko'rinishidagi nisbiy yo'l — `..`, bo'sh
// joy yoki tashqi URL o'chirish/yozishga yetib bormasin.
const SAFE_UPLOAD_PATH = /^\/uploads\/[a-z0-9_-]+\/[A-Za-z0-9_.-]+$/;

/**
 * Fayl saqlash
 * @param {File} file
 * @param {'logos'} folder
 * @param {string} name fayl nomi
 * @param {number} [index] fayl raqami (optional)
 * @returns {Promise<string>} fayl joylashgan manzili namuna: /uploads/logos/1.jpg
 */
async function save(file, folder, name, index) {
  if (!file || !folder) throw new Error("File tanlanmadi");

  if (!Object.values(FOLDERS).includes(folder)) {
    throw new Error("Noto'g'ri folder nomi");
  }

  const uploadDir = `/uploads/${folder}`;

  fs.mkdirSync(`.${uploadDir}`, { recursive: true });

  const ext = path.extname(file.name).toLowerCase();
  const allowed = ALLOWED_EXTENSIONS[folder] || [];
  if (!allowed.includes(ext)) {
    throw new Error("common.fileTypeNotAllowed");
  }

  const fileName =
    index !== undefined
      ? `${md5(name + getNow() + file?.name)}_${index}${ext}`
      : `${md5(name + getNow() + file?.name)}${ext}`;

  const filePath = `${uploadDir}/${fileName}`;

  await new Promise((resolve, reject) => {
    file.mv(`.${filePath}`, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });

  return `${filePath}`;
}

/**
 * Tayyor buffer'ni (masalan sharp natijasi) saqlash. Barcha disk I/O shu
 * faylda — keyin S3/boshqa serverga ko'chishda faqat shu yer o'zgaradi.
 * Nom: md5 + kriptografik tasodif (getNow() soniya aniqligida — bir soniyada
 * ikki yuklash to'qnashmasin).
 * @param {Buffer} buffer
 * @param {string} folder FOLDERS qiymatlaridan biri
 * @param {string} ext masalan ".webp"
 * @returns {Promise<string>} nisbiy yo'l, namuna: /uploads/students/abc.webp
 */
async function saveBuffer(buffer, folder, ext) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error("File tanlanmadi");
  if (!Object.values(FOLDERS).includes(folder)) throw new Error("Noto'g'ri folder nomi");

  const extension = String(ext || "").toLowerCase();
  const allowed = ALLOWED_EXTENSIONS[folder] || [];
  if (!allowed.includes(extension)) throw new Error("common.fileTypeNotAllowed");

  const uploadDir = `/uploads/${folder}`;
  await fs.promises.mkdir(`.${uploadDir}`, { recursive: true });

  const random = crypto.randomBytes(8).toString("hex");
  const fileName = `${md5(`${folder}${getNow()}${random}`)}${random}${extension}`;
  const filePath = `${uploadDir}/${fileName}`;

  // `wx` — mavjud faylni hech qachon ustidan yozmaydi.
  await fs.promises.writeFile(`.${filePath}`, buffer, { flag: "wx" });
  return filePath;
}

/**
 * Fayl o'chirish — faqat `/uploads/...` ichidagi fayl. Xato (yo'q fayl va h.k.)
 * tashlanmaydi, chunki o'chirish har doim asosiy amaldan KEYIN bajariladi.
 * @param {string} file
 * @returns {Promise<boolean>}
 */
async function remove(file) {
  if (typeof file !== "string" || !SAFE_UPLOAD_PATH.test(file) || file.includes("..")) {
    return false;
  }
  try {
    await fs.promises.unlink(`.${file}`);
    return true;
  } catch (err) {
    if (err.code !== "ENOENT") console.log(err);
    return false;
  }
}
module.exports = { save, saveBuffer, remove };
