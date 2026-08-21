const path = require("path");
const fs = require("fs");
const md5 = require("md5");
const { getNow } = require("./date.util");
const { FOLDERS } = require("../configs/folder.config");
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

  const ext = path.extname(file.name);

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
