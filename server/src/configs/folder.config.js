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
};

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const ensureFolders = () => {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  Object.values(FOLDERS).forEach((folder) => {
    fs.mkdirSync(path.join(UPLOAD_DIR, folder), { recursive: true });
  });
};

module.exports = { FOLDERS, ensureFolders };
