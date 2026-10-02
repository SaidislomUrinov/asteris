const TutorialVideo = require("../models/TutorialVideo");

// Faqat validatsiya uchun — saqlanadigan qiymat foydalanuvchi kiritgan
// original URL, bu regexdan chiqarilgan ID emas.
const YOUTUBE_ID_RE =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

module.exports = {
  list: async () => {
    const rows = await TutorialVideo.find();
    // Client ilovasi array skan qilmasligi uchun {sectionKey: youtubeUrl} map qaytariladi.
    return rows.reduce((acc, row) => {
      acc[row.sectionKey] = row.youtubeUrl;
      return acc;
    }, {});
  },

  upsert: async (sectionKey, youtubeUrl) => {
    if (!YOUTUBE_ID_RE.test(String(youtubeUrl || ""))) {
      throw new Error("tutorialVideo.invalidUrl");
    }

    const doc = await TutorialVideo.findOneAndUpdate(
      { sectionKey },
      { sectionKey, youtubeUrl },
      { upsert: true, new: true },
    );

    return { sectionKey: doc.sectionKey, youtubeUrl: doc.youtubeUrl };
  },

  remove: async (sectionKey) => {
    await TutorialVideo.deleteOne({ sectionKey });
  },
};
