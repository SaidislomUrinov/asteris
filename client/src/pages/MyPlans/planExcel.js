// Dars rejasi Excel importi — fayldan modul/dars daraxtiga
// (docs/API_CONTRACT_teaching_plan_excel_import.md §2–3). Sof funksiyalar:
// fayl o'qish import oynasida, bu yerda faqat jadval → daraxt va tekshiruv.

// Server cheklovlari bilan bir xil (server/src/utils/syllabusTree.util.js).
export const MAX_MODULES = 50;
export const MAX_LESSONS_PER_MODULE = 200;

// 4 tildagi namuna sarlavhalari (server `TEMPLATE_TEXT` bilan bir xil) —
// birinchi qatorda shulardan biri bo'lsa u sarlavha deb tashlab yuboriladi.
const MODULE_HEADERS = ["modul", "модул", "модуль", "module"];
const TITLE_HEADERS = ["dars mavzusi", "дарс мавзуси", "тема урока", "lesson topic", "mavzu", "тема", "topic"];

const norm = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const lower = (v) => norm(v).toLowerCase();

let seq = 0;
// Oyna ichidagi qatorlar uchun barqaror key (serverga yuborilmaydi).
export const tempKey = () => `tmp-${Date.now().toString(36)}-${(seq += 1)}`;

// `read-excel-file` ba'zan qatorlarni, ba'zan varaqlar ro'yxatini qaytaradi —
// ko'p varaqli kitobda eng ko'p qatorli varaq olinadi (o'quvchi importi naqshi).
export const normalizeSheetRows = (parsed) => {
  if (!Array.isArray(parsed) || !parsed.length) return [];
  const rows = Array.isArray(parsed[0])
    ? parsed
    : (() => {
        const sheets = parsed.filter((s) => Array.isArray(s?.data));
        if (!sheets.length) return [];
        return sheets.reduce((best, s) => (s.data.length > best.data.length ? s : best)).data;
      })();
  return rows.filter((row) => Array.isArray(row)).map((row) => row.map((cell) => (cell == null ? "" : cell)));
};

// Oddiy CSV (vergul yoki nuqta-vergul, qo'shtirnoqli maydonlar).
export const parseCsv = (text) => {
  const delimiter = (text.split("\n")[0] || "").split(";").length > (text.split("\n")[0] || "").split(",").length ? ";" : ",";
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
};

const isEmptyRow = (row) => row.every((c) => !norm(c));

// Birinchi bo'sh bo'lmagan qator sarlavhami va qaysi formatda?
const detectHeader = (row) => {
  const cells = row.map(lower);
  const hasModule = MODULE_HEADERS.includes(cells[0]);
  const hasTitle = cells.some((c) => TITLE_HEADERS.includes(c));
  if (hasModule) return "plan";
  if (hasTitle) return "lessons";
  return null;
};

/**
 * Jadval → modullar.
 * @param {Array<Array>} table - fayldagi qatorlar
 * @param {"plan"|"lessons"} kind
 * @param {string} defaultModuleTitle - modul ko'rsatilmagan birinchi qatorlar uchun ("Modul 1")
 * @returns {Array<{key, title, lessons: Array<{key, title, description, homework}>}>}
 */
export const tableToModules = (table, kind, defaultModuleTitle) => {
  const rows = table.filter((r) => !isEmptyRow(r));
  if (!rows.length) return [];

  const header = detectHeader(rows[0]);
  const body = header ? rows.slice(1) : rows;
  // Fayl formati: sarlavha bo'yicha; sarlavhasiz — tanlangan rejim bo'yicha.
  const fileHasModule = header ? header === "plan" : kind === "plan";
  const off = fileHasModule ? 1 : 0;

  const lessonOf = (r) => ({
    key: tempKey(),
    title: norm(r[off]),
    description: norm(r[off + 1]),
    homework: norm(r[off + 2]),
  });

  if (kind === "lessons") {
    return [{ key: tempKey(), title: "", lessons: body.map(lessonOf).filter((l) => l.title || l.description || l.homework) }];
  }

  const modules = [];
  let current = null;
  for (const r of body) {
    const moduleTitle = fileHasModule ? norm(r[0]) : "";
    if (moduleTitle || !current) {
      current = { key: tempKey(), title: moduleTitle || defaultModuleTitle, lessons: [] };
      modules.push(current);
    }
    const lesson = lessonOf(r);
    if (lesson.title || lesson.description || lesson.homework) current.lessons.push(lesson);
  }
  return modules;
};

/**
 * Oynadagi daraxtni tekshiradi (server qoidalari bilan bir xil).
 * @param {Array} modules - import qilinayotganlar
 * @param {{ kind: "plan"|"lessons", existingModules: number, existingLessons: number, replace: boolean }} ctx
 * @returns {{ errors: string[], invalid: Set<string> }} invalid — xato qatorlar key'lari
 */
export const validateImport = (modules, ctx) => {
  const errors = [];
  const invalid = new Set();
  let lessonCount = 0;

  modules.forEach((m) => {
    if (ctx.kind === "plan" && !m.title.trim()) invalid.add(m.key);
    m.lessons.forEach((l) => {
      lessonCount += 1;
      if (!l.title.trim()) invalid.add(l.key);
    });
  });

  if (invalid.size) errors.push("teachingPlan.import.rowInvalid");
  if (ctx.kind === "plan") {
    const total = (ctx.replace ? 0 : ctx.existingModules) + modules.length;
    if (total > MAX_MODULES) errors.push("teachingPlan.import.tooManyModules");
    if (modules.some((m) => m.lessons.length > MAX_LESSONS_PER_MODULE)) errors.push("teachingPlan.import.tooManyLessons");
  } else if (ctx.existingLessons + lessonCount > MAX_LESSONS_PER_MODULE) {
    errors.push("teachingPlan.import.tooManyLessons");
  }
  if (!lessonCount && (ctx.kind === "lessons" || !modules.length)) errors.push("teachingPlan.import.empty");

  return { errors, invalid };
};

// Oynadagi qatorlar → serverga yuboriladigan shakl (`_id`siz, faqat kerakli maydonlar).
export const toServerLessons = (lessons) =>
  lessons.map((l) => ({ title: l.title.trim(), description: l.description.trim(), homework: l.homework.trim() }));
