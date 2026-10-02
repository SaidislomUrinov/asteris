const path = require("path");
const fs = require("fs");
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
};

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
    throw new Error("Ruxsat etilmagan fayl turi");
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
 * Fayl o'chirish
 * @param {string} file
 * @returns {Promise<boolean>}
 */
async function remove(file) {
  fs.unlink(`.${file}`, (err) => {
    if (err) {
      console.log(err);
      return false;
    }
  });
  return true;
}
module.exports = { save, remove };
