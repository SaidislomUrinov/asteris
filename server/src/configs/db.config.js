const mongoose = require("mongoose");
const env = require("./env.config");
const Admin = require("../models/Admin");
const { getHash } = require("../utils/hash.util");
const migrateGradeScale = require("../scripts/migrate-grade-scale");
const migrateChatParticipants = require("../scripts/migrate-chat-participants");
const migrateStudentPhotos = require("../scripts/migrate-student-photos");

const seedOwnerAdmin = async () => {
  try {
    const owner = await Admin.findOne({ role: "owner" });
    if (owner) return;

    if (!env.ADMIN_USERNAME || !env.ADMIN_PASS) {
      console.warn(
        "Owner admin topilmadi va ADMIN_USERNAME/ADMIN_PASS env'da berilmagan — seed o'tkazib yuborildi",
      );
      return;
    }

    await Admin.create({
      name: env.ADMIN_NAME || "Owner",
      username: env.ADMIN_USERNAME.toLowerCase().trim(),
      password: await getHash(env.ADMIN_PASS.trim()),
      role: "owner",
      permissions: ["all"],
    });

    console.log("Owner admin seed qilindi");
  } catch (err) {
    console.error("Owner admin seed xatosi:", err.message);
  }
};

const connectDB = async () => {
  try {
    await mongoose.connect(env.MONGO_URI);
    console.log(`MongoDB connected (pid: ${process.pid})`);
    await seedOwnerAdmin();
    // Bir martalik ma'lumot migratsiyalari — idempotent, har ishga tushishda.
    try {
      await migrateGradeScale();
    } catch (err) {
      console.error("Baho shkalasi migratsiya xatosi:", err.message);
    }
    try {
      await migrateChatParticipants();
    } catch (err) {
      console.error("Chat suhbatlari migratsiya xatosi:", err.message);
    }
    try {
      await migrateStudentPhotos();
    } catch (err) {
      console.error("O'quvchi rasmlari migratsiya xatosi:", err.message);
    }
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
