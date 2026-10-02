const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

// Server loglari (PM2 `ecosystem.config.js` → `logs/out.log`, `logs/error.log`).
// Faqat O'QISH — fayllar tozalanmaydi/o'zgartirilmaydi. Fayl nomi foydalanuvchi
// kiritgan satrdan emas, qat'iy ro'yxatdan olinadi (path traversal yo'q).
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, "..", "..", "logs");
const FILES = { out: "out.log", error: "error.log" };

const DEFAULT_LINES = 500;
const MAX_LINES = 5000;
// Oxiridan ko'pi bilan shuncha bayt o'qiladi — katta fayl xotirani to'ldirmasin.
const MAX_READ_BYTES = 8 * 1024 * 1024;
const CHUNK = 256 * 1024;

// PM2 `time: true` prefiksi: "2026-09-28T10:05:12: xabar" (ba'zan ms/zona bilan).
const TIME_PREFIX = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?):\s?/;
// Terminal rang kodlari (chalk va h.k.) — brauzerda axlat bo'lib ko'rinadi.
const ANSI = /\x1b\[[0-9;]*m/g; // eslint-disable-line no-control-regex

const resolveFile = (key) => {
  const name = FILES[key];
  if (!name) throw new Error("logs.invalidFile");
  return path.join(LOG_DIR, name);
};

const statOrNull = async (filePath) => {
  try {
    return await fsp.stat(filePath);
  } catch {
    return null;
  }
};

// Fayl oxiridan `CHUNK` bo'laklab orqaga o'qiydi, yetarli qator yig'ilguncha
// (yoki MAX_READ_BYTES chegarasigacha).
const readTail = async (filePath, size, wantLines) => {
  const fh = await fsp.open(filePath, "r");
  try {
    let pos = size;
    let read = 0;
    const chunks = [];
    let newlines = 0;
    while (pos > 0 && read < MAX_READ_BYTES && newlines <= wantLines) {
      const len = Math.min(CHUNK, pos, MAX_READ_BYTES - read);
      pos -= len;
      const buf = Buffer.alloc(len);
      await fh.read(buf, 0, len, pos);
      chunks.unshift(buf);
      read += len;
      for (let i = 0; i < len; i += 1) if (buf[i] === 10) newlines += 1;
    }
    let text = Buffer.concat(chunks).toString("utf8");
    // Birinchi qator yarmidan kesilgan bo'lishi mumkin — tashlab yuboriladi.
    if (pos > 0) text = text.slice(text.indexOf("\n") + 1);
    return { text, reachedStart: pos === 0 };
  } finally {
    await fh.close();
  }
};

const parseLine = (raw) => {
  const clean = raw.replace(ANSI, "");
  const m = clean.match(TIME_PREFIX);
  return m ? { time: m[1], text: clean.slice(m[0].length) } : { time: null, text: clean };
};

module.exports = {
  files: async () => {
    const list = await Promise.all(
      Object.keys(FILES).map(async (key) => {
        const stat = await statOrNull(resolveFile(key));
        return {
          key,
          name: FILES[key],
          exists: !!stat,
          size: stat?.size || 0,
          modifiedAt: stat ? Math.floor(stat.mtimeMs / 1000) : null,
        };
      }),
    );
    return list;
  },

  // Oxirgi `lines` ta qator (search bo'lsa — mos keladiganlardan oxirgi `lines` tasi).
  tail: async ({ file = "out", lines, search } = {}) => {
    const filePath = resolveFile(file);
    const limit = Math.min(MAX_LINES, Math.max(1, Number(lines) || DEFAULT_LINES));
    const query = String(search || "").trim().toLowerCase();

    const stat = await statOrNull(filePath);
    if (!stat) return { file, exists: false, size: 0, lines: [], truncated: false };

    // Qidiruvda mos qatorlar siyrak bo'lishi mumkin — butun oynani o'qiymiz.
    const want = query ? Number.MAX_SAFE_INTEGER : limit;
    const { text, reachedStart } = await readTail(filePath, stat.size, want);

    let rows = text.split("\n");
    if (rows.length && rows[rows.length - 1] === "") rows.pop();
    let parsed = rows.map(parseLine);
    if (query) parsed = parsed.filter((r) => r.text.toLowerCase().includes(query));

    const hasMore = parsed.length > limit || !reachedStart;
    parsed = parsed.slice(-limit);

    return {
      file,
      exists: true,
      size: stat.size,
      modifiedAt: Math.floor(stat.mtimeMs / 1000),
      lines: parsed,
      truncated: hasMore,
    };
  },

  // Yuklab olish uchun to'liq yo'l (controller `res.download` qiladi).
  downloadPath: async (file) => {
    const filePath = resolveFile(file);
    if (!fs.existsSync(filePath)) throw new Error("logs.notFound");
    return { filePath, name: FILES[file] };
  },
};
