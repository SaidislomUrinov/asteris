const mongoose = require("mongoose");
const env = require("../src/configs/env.config");
const Lead = require("../src/models/Lead");
const Admin = require("../src/models/Admin");
const { getNow } = require("../src/utils/date.util");

const FIRST = [
  "Aziz", "Dilnoza", "Jasur", "Nodira", "Sardor", "Malika", "Bekzod", "Zarina",
  "Otabek", "Gulnoza", "Sherzod", "Madina", "Rustam", "Feruza", "Ulug'bek",
  "Sevinch", "Farrux", "Nilufar", "Javlon", "Ziyoda", "Doston", "Kamola",
  "Ilyos", "Munisa", "Sanjar", "Diyora", "Akmal", "Shahnoza", "Bobur", "Lola",
];
const LAST = [
  "Karimov", "Yusupova", "Rashidov", "Tosheva", "Nazarov", "Ergasheva",
  "Xolmatov", "Saidova", "Umarov", "Qodirova", "Mirzayev", "Abdullayeva",
];

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const STATUSES = Lead.STATUSES;
const PLATFORMS = Lead.PLATFORMS;

const buildHistory = (statuses, adminId) => {
  const history = [];
  let from = null;
  for (const to of statuses) {
    history.push({
      from,
      to,
      comment: rand([
        "Mijoz bilan bog'lanildi",
        "Qayta aloqa so'radi",
        "Narx bo'yicha savol berdi",
        "",
        "Vaqtincha band, keyinroq javob beradi",
      ]),
      changedBy: adminId,
      changedAt: getNow() - randInt(0, 60 * 60 * 24 * 20),
    });
    from = to;
  }
  return history;
};

// Har bir status uchun realistik "yo'l" (pending'dan boshlab)
const PATHS = {
  pending: [],
  contacted: ["contacted"],
  rejected: ["contacted", "rejected"],
  confirmed: ["contacted", "confirmed"],
  recontact: ["contacted", "recontact"],
};

const start = async () => {
  await mongoose.connect(env.MONGO_URI);

  const admin = await Admin.findOne({ role: "owner" });
  if (!admin) throw new Error("Owner admin topilmadi, avval admin seed qiling");

  const docs = [];
  for (let i = 0; i < 100; i++) {
    const status = STATUSES[i % STATUSES.length];
    const platform = rand(PLATFORMS);
    const path = PATHS[status];

    docs.push({
      name: `${rand(FIRST)} ${rand(LAST)}`,
      phone: `+99890${randInt(1000000, 9999999)}`,
      comment: rand([
        "Kurs narxi haqida so'radi",
        "Bepul sinov darsiga yozildi",
        "Filiallar haqida qiziqdi",
        "",
        "Ish vaqti haqida so'radi",
      ]),
      platform,
      platformNote: platform === "other" ? rand(["TikTok", "Do'stidan eshitgan", "Yandex"]) : "",
      status,
      statusHistory: buildHistory(path, admin._id),
      createdAt: getNow() - randInt(0, 60 * 60 * 24 * 30),
    });
  }

  await Lead.insertMany(docs);
  console.log(`${docs.length} ta test lead qo'shildi`);
  process.exit(0);
};

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
