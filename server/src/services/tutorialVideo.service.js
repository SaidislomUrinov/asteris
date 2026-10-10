const TutorialVideo = require("../models/TutorialVideo");

// Faqat validatsiya uchun — saqlanadigan qiymat foydalanuvchi kiritgan
// original URL, bu regexdan chiqarilgan ID emas.
const YOUTUBE_ID_RE =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

const TITLE_MAX = 120;

const toDto = (row) => ({
  sectionKey: row.sectionKey,
  youtubeUrl: row.youtubeUrl,
  title: row.title || "",
  order: row.order || 0,
});

// Eski hujjatlarda order=0 — createdAt ikkinchi kalit sifatida barqaror tartib beradi.
const listSorted = async () => {
  const rows = await TutorialVideo.find().sort({ order: 1, createdAt: 1 }).lean();
  return rows.map(toDto);
};

module.exports = {
  list: listSorted,

  upsert: async (sectionKey, { youtubeUrl, title } = {}) => {
    if (!YOUTUBE_ID_RE.test(String(youtubeUrl || ""))) {
      throw new Error("tutorialVideo.invalidUrl");
    }
    const cleanTitle = String(title || "").trim().slice(0, TITLE_MAX);

    const existing = await TutorialVideo.findOne({ sectionKey });
    if (existing) {
      existing.youtubeUrl = youtubeUrl;
      existing.title = cleanTitle;
      await existing.save();
      return toDto(existing);
    }

    // Yangi video ro'yxat oxiriga qo'shiladi.
    const last = await TutorialVideo.findOne().sort({ order: -1 }).select("order").lean();
    const doc = await TutorialVideo.create({
      sectionKey,
      youtubeUrl,
      title: cleanTitle,
      order: (last?.order || 0) + 1,
    });
    return toDto(doc);
  },

  reorder: async (keys) => {
    if (!Array.isArray(keys) || keys.some((k) => typeof k !== "string")) {
      throw new Error("tutorialVideo.invalidOrder");
    }
    const unique = [...new Set(keys)];
    if (unique.length) {
      await TutorialVideo.bulkWrite(
        unique.map((sectionKey, index) => ({
          updateOne: { filter: { sectionKey }, update: { $set: { order: index + 1 } } },
        })),
      );
    }
    return listSorted();
  },

  remove: async (sectionKey) => {
    await TutorialVideo.deleteOne({ sectionKey });
  },
};
