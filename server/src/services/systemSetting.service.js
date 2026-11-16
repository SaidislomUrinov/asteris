const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const SystemSetting = require("../models/SystemSetting");
const redisUtil = require("../utils/redis.util");
const env = require("../configs/env.config");
const { getNow, formatDate } = require("../utils/date.util");

// ioredis `keyPrefix: "asteris:"` ni O'ZI qo'shadi (redis.config.js), shuning
// uchun bu yerda prefiks yozilmaydi — Redis'dagi yakuniy kalit
// `asteris:system_setting` bo'ladi (CLAUDE.md kalit naqshi).
const CACHE_KEY = "system_setting";
const CACHE_TTL = 3600;

const BACKUP_DIR = path.resolve(process.cwd(), env.BACKUP_DIR || "./backups");
// Yuklangan fayllar (logo, rasm, shrift, sertifikat) — app.js dagi /uploads static.
const UPLOADS_DIR = path.join(__dirname, "..", "..", "uploads");

// Bola-protsessni ishga tushirib, tugashini kutadi.
const runProcess = (cmd, args, notFoundMsg) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", () => reject(new Error(notFoundMsg)));
    child.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(stderr.trim().split("\n").pop() || "settings.backupFailed"));
    });
  });

// Maxfiy maydonlar javobda HECH QACHON ochiq ketmaydi — faqat "bor/yo'q".
const DTO = (s) => ({
  smtp: {
    enabled: !!s.smtp?.enabled,
    host: s.smtp?.host || "",
    port: s.smtp?.port ?? 465,
    secure: !!s.smtp?.secure,
    user: s.smtp?.user || "",
    hasPassword: !!s.smtp?.pass,
    fromName: s.smtp?.fromName || "",
    fromEmail: s.smtp?.fromEmail || "",
  },
  telegram: {
    enabled: !!s.telegram?.enabled,
    hasBotToken: !!s.telegram?.botToken,
    alertChatIds: s.telegram?.alertChatIds || [],
    leadChatIds: s.telegram?.leadChatIds || [],
    parentWebAppUrl: s.telegram?.parentWebAppUrl || "",
    alerts: {
      serverError: s.telegram?.alerts?.serverError !== false,
      healthDegraded: s.telegram?.alerts?.healthDegraded !== false,
      subscriptionExpiring: s.telegram?.alerts?.subscriptionExpiring !== false,
      newLead: s.telegram?.alerts?.newLead !== false,
      leadStatus: s.telegram?.alerts?.leadStatus !== false,
    },
  },
  storage: {
    driver: s.storage?.driver || "local",
    baseUrl: s.storage?.baseUrl || "",
    maxFileMb: s.storage?.maxFileMb ?? 10,
  },
  backup: {
    enabled: !!s.backup?.enabled,
    cron: s.backup?.cron || "03:00",
    keepDays: s.backup?.keepDays ?? 7,
    lastRunAt: s.backup?.lastRunAt || null,
    lastRunDate: s.backup?.lastRunAt ? formatDate(s.backup.lastRunAt) : "",
    lastStatus: s.backup?.lastStatus || "",
  },
  updatedAt: s.updatedAt || null,
  lastUpdate: s.updatedAt ? formatDate(s.updatedAt) : "",
});

// Singleton hujjat — yo'q bo'lsa default qiymatlar bilan yaratiladi.
const getOrCreate = async () => {
  let doc = await SystemSetting.findOne({ key: "global" });
  if (!doc) doc = await SystemSetting.create({ key: "global" });
  return doc;
};

// Ichki foydalanuvchilar (mail.util, bot, joblar) uchun — MAXFIY maydonlar
// bilan, keshdan. Redis ishlamasa DB'ga tushadi, hech qachon otmaydi.
const getRaw = async () => {
  try {
    const cached = await redisUtil.get(CACHE_KEY);
    if (cached) return cached;
  } catch {
    // kesh yo'q bo'lsa DB'dan o'qiymiz
  }

  const doc = await getOrCreate();
  const plain = doc.toObject ? doc.toObject() : doc;

  try {
    await redisUtil.set(CACHE_KEY, plain, CACHE_TTL);
  } catch {
    // kesh yozilmasa ham javob tayyor
  }

  return plain;
};

const invalidate = async () => {
  try {
    await redisUtil.del(CACHE_KEY);
  } catch {
    // eng yomoni — 1 soatgacha eski sozlama
  }
};

// PATCH: faqat kelgan maydonlar yangilanadi. Parol/token BO'SH kelsa —
// eskisi saqlanadi (foydalanuvchi parolni qayta yozishi shart emas).
const buildUpdate = (body, current) => {
  const $set = {};

  if (body.smtp) {
    const s = body.smtp;
    if (s.enabled !== undefined) $set["smtp.enabled"] = !!s.enabled;
    if (s.host !== undefined) $set["smtp.host"] = String(s.host).trim();
    if (s.port !== undefined) $set["smtp.port"] = Number(s.port) || 465;
    if (s.secure !== undefined) $set["smtp.secure"] = !!s.secure;
    if (s.user !== undefined) $set["smtp.user"] = String(s.user).trim();
    if (s.fromName !== undefined) $set["smtp.fromName"] = String(s.fromName).trim();
    if (s.fromEmail !== undefined) $set["smtp.fromEmail"] = String(s.fromEmail).trim();
    // Bo'sh string = "o'zgartirma", null = "tozala".
    if (s.pass !== undefined && String(s.pass).trim() !== "") $set["smtp.pass"] = String(s.pass).trim();
    if (s.pass === null) $set["smtp.pass"] = "";
  }

  if (body.telegram) {
    const t = body.telegram;
    if (t.enabled !== undefined) $set["telegram.enabled"] = !!t.enabled;
    if (t.botToken !== undefined && String(t.botToken).trim() !== "")
      $set["telegram.botToken"] = String(t.botToken).trim();
    if (t.botToken === null) $set["telegram.botToken"] = "";
    if (Array.isArray(t.alertChatIds))
      $set["telegram.alertChatIds"] = t.alertChatIds.map((id) => String(id).trim()).filter(Boolean);
    if (Array.isArray(t.leadChatIds))
      $set["telegram.leadChatIds"] = t.leadChatIds.map((id) => String(id).trim()).filter(Boolean);
    if (t.parentWebAppUrl !== undefined) $set["telegram.parentWebAppUrl"] = String(t.parentWebAppUrl || "").trim();
    if (t.alerts) {
      for (const k of ["serverError", "healthDegraded", "subscriptionExpiring", "newLead", "leadStatus"]) {
        if (t.alerts[k] !== undefined) $set[`telegram.alerts.${k}`] = !!t.alerts[k];
      }
    }
  }

  if (body.storage) {
    const st = body.storage;
    if (st.driver !== undefined) {
      if (!["local", "s3"].includes(st.driver)) throw new Error("settings.invalidStorageDriver");
      $set["storage.driver"] = st.driver;
    }
    if (st.baseUrl !== undefined) $set["storage.baseUrl"] = String(st.baseUrl).trim();
    if (st.maxFileMb !== undefined) $set["storage.maxFileMb"] = Math.max(1, Number(st.maxFileMb) || 10);
  }

  if (body.backup) {
    const b = body.backup;
    if (b.enabled !== undefined) $set["backup.enabled"] = !!b.enabled;
    if (b.cron !== undefined) {
      const cron = String(b.cron).trim();
      if (!/^\d{2}:\d{2}$/.test(cron)) throw new Error("settings.invalidBackupCron");
      $set["backup.cron"] = cron;
    }
    if (b.keepDays !== undefined) $set["backup.keepDays"] = Math.max(1, Number(b.keepDays) || 7);
  }

  // `current` faqat kelajakdagi validatsiyalar uchun — hozircha ishlatilmaydi.
  void current;
  return $set;
};

const ensureBackupDir = () => {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
};

// mongodump'ni bola-protsess sifatida chaqiradi. `mongodump` o'rnatilmagan
// bo'lsa — xato TASHLANADI (bu endpoint foydalanuvchi so'rovi, natija kerak),
// lekin job ichida chaqiruv fire-and-forget bo'ladi.
const runBackup = async () => {
  if (!env.MONGO_URI) throw new Error("settings.mongoUriMissing");
  ensureBackupDir();

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const file = `asteris-${stamp}.gz`;
  const target = path.join(BACKUP_DIR, file);
  const startedAt = Date.now();

  await runProcess("mongodump", [`--uri=${env.MONGO_URI}`, "--gzip", `--archive=${target}`], "settings.mongodumpNotFound");

  // uploads/ ham zaxiralanadi — busiz tiklangan bazadagi rasm/fayl havolalari o'lik bo'ladi.
  let uploadsFile = null;
  if (fs.existsSync(UPLOADS_DIR)) {
    uploadsFile = `asteris-uploads-${stamp}.tar.gz`;
    await runProcess(
      "tar",
      ["-czf", path.join(BACKUP_DIR, uploadsFile), "-C", path.dirname(UPLOADS_DIR), path.basename(UPLOADS_DIR)],
      "settings.backupFailed",
    );
  }

  const sizeMb = Number((fs.statSync(target).size / 1024 / 1024).toFixed(2));
  const durationMs = Date.now() - startedAt;

  await SystemSetting.updateOne(
    { key: "global" },
    { $set: { "backup.lastRunAt": getNow(), "backup.lastStatus": "success", updatedAt: getNow() } },
    { upsert: true },
  );
  await invalidate();

  return { file, uploadsFile, sizeMb, durationMs };
};

// `keepDays` dan eski backup fayllarini o'chiradi (backup.job.js chaqiradi).
const cleanOldBackups = async (keepDays) => {
  try {
    ensureBackupDir();
    const limit = Date.now() - Math.max(1, keepDays) * 86400 * 1000;
    for (const file of fs.readdirSync(BACKUP_DIR)) {
      const full = path.join(BACKUP_DIR, file);
      if (fs.statSync(full).mtimeMs < limit) fs.unlinkSync(full);
    }
  } catch {
    // tozalash uddalanmasa ham backupning o'zi muhimroq
  }
};

const listBackups = async () => {
  ensureBackupDir();
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith(".gz"))
    .map((f) => {
      const st = fs.statSync(path.join(BACKUP_DIR, f));
      const createdAt = Math.floor(st.mtimeMs / 1000);
      return {
        file: f,
        sizeMb: Number((st.size / 1024 / 1024).toFixed(2)),
        createdAt,
        date: formatDate(createdAt),
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
};

module.exports = {
  DTO,
  getRaw,
  invalidate,
  cleanOldBackups,
  BACKUP_DIR,

  getSettings: async () => DTO(await getOrCreate()),

  updateSettings: async (body, adminId) => {
    const current = await getOrCreate();
    const $set = buildUpdate(body || {}, current);
    $set.updatedAt = getNow();
    if (adminId) $set.updatedBy = adminId;

    const doc = await SystemSetting.findOneAndUpdate({ key: "global" }, { $set }, { returnDocument: "after", upsert: true });

    await invalidate();
    // SMTP o'zgargan bo'lishi mumkin — keshlangan transport bekor qilinadi.
    require("../utils/mail.util").resetTransport();

    return DTO(doc);
  },

  testSmtp: async (to) => {
    if (!to || !String(to).includes("@")) throw new Error("settings.invalidEmail");

    const result = await require("../utils/mail.util").sendMail({
      to: String(to).trim(),
      subject: "WENET — sinov xati",
      template: "test",
      data: { date: formatDate(getNow()) },
    });

    if (!result.ok) throw new Error(result.error || "settings.smtpFailed");
    return result;
  },

  testTelegram: async () => {
    const result = await require("../bot/alert").sendAlert(
      "test",
      { title: "WENET — sinov xabari", body: `Vaqt: ${formatDate(getNow())}` },
      { force: true },
    );

    if (!result.ok) throw new Error(result.error || "settings.telegramFailed");
    return result;
  },

  runBackup,
  listBackups,
};
