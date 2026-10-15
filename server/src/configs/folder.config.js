const fs = require("fs");
const path = require("path");

const FOLDERS = {
  LOGOS: "logos",
  CERTIFICATES: "certificates",
  FONTS: "fonts",
  CHAT_IMAGES: "chat",
  // Yangiliklar media (rasm + video) — API_CONTRACT_news.md §2
  NEWS: "news",
  // O'quvchi rasmlari (sharp → 360x360 webp) — API_CONTRACT_student_photo.md §1
  STUDENTS: "students",
  // Filial do'koni mahsulotlari (sharp → 512x512 webp) — API_CONTRACT_wecoin.md §3
  SHOP: "shop",
};

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const ensureFolders = () => {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  Object.values(FOLDERS).forEach((folder) => {
    fs.mkdirSync(path.join(UPLOAD_DIR, folder), { recursive: true });
  });
};

module.exports = { FOLDERS, ensureFolders };
