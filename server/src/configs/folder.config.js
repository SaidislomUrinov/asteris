const fs = require("fs");
const path = require("path");

const FOLDERS = {
  LOGOS: "logos",
};

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const ensureFolders = () => {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  Object.values(FOLDERS).forEach((folder) => {
    fs.mkdirSync(path.join(UPLOAD_DIR, folder), { recursive: true });
  });
};

module.exports = { FOLDERS, ensureFolders };
