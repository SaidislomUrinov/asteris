import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import readXlsxFile from "read-excel-file/browser";
import { useTranslation } from "react-i18next";
import {
  HiArrowRight,
  HiArrowUpTray,
  HiArrowUturnLeft,
  HiBanknotes,
  HiCalendarDays,
  HiCheck,
  HiCheckCircle,
  HiChevronDown,
  HiExclamationTriangle,
  HiInformationCircle,
  HiMinusCircle,
  HiPaperAirplane,
  HiPhone,
  HiPlus,
  HiTableCells,
  HiTag,
  HiTrash,
  HiUser,
} from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Button from "../../ui/Button";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import StartDateField from "../Students/StartDateField";
import { assertStartDate, startDateMinOf, tashkentDay } from "../Students/startDate.util";
import {
  cleanTelegramValue,
  isValidTelegramPhone,
  sanitizeTelegramInput,
} from "../../utils/telegramPhone";

const PHONE_PREFIX = "+998";
const MAX_ROWS = 300;

// Ustunlarni avtomatik moslash uchun kalit so'zlar (API_CONTRACT_student_import.md §6).
const FIELD_KEYWORDS = {
  fullName: ["ism", "фио", "f.i.sh", "fish", "name", "имя"],
  phone: ["telefon", "тел", "phone", "raqam"],
  parentPhone: ["ota-ona", "qo'shimcha", "родител", "parent"],
  price: ["narx", "цена", "price", "narxi"],
  openingBalance: ["qarz", "долг", "balance", "qoldiq"],
  startDate: ["sana", "boshla", "дата", "start", "date"],
};
// DIQQAT: tartib muhim — `guessColumn` birinchi mos kelganida to'xtaydi.
// `parentPhone` `phone` dan OLDIN turishi shart: "Ota-ona raqami" sarlavhasi
// ham `phone` ning "raqam" kalit so'ziga mos keladi va oldin tekshirilsa
// ota-ona ustuni o'quvchining telefoni deb topilardi (ikki ustun bitta
// maydonga tushib, ma'lumot yo'qolardi).
// `startDate` OXIRIDA: "Boshlang'ich qarz" sarlavhasi "boshla" ga ham mos
// keladi — avval `openingBalance` ("qarz") tekshirilishi kerak.
const FIELD_KEYS = ["fullName", "parentPhone", "phone", "price", "openingBalance", "startDate"];

const PHONE_REGEX = /^\d{9}$/;

// Ixtiyoriy Telegram ustunlari (API_CONTRACT_telegram_phone.md §4 Excel import).
// Sarlavhada "telegram" bo'lsa telefon kalit so'zlaridan OLDIN tekshiriladi:
// "Ota-ona Telegram" aks holda `parentPhone` ga tushib qolardi.
const TELEGRAM_KEYWORDS = ["telegram", "телеграм", "tg"];
const PARENT_KEYWORDS = ["ota-ona", "ota ona", "родител", "parent"];

// Ustun moslash dropdownidagi bandlar. Maydonlar ro'yxati O'ZGARMADI —
// faqat har biriga ikonka qo'shildi (dizayn talabi).
// `withStartDate` — guruh faol bo'lsagina "Boshlagan sana" maydoni bor
// (pending guruhda server sanani e'tiborsiz qoldiradi).
const FIELD_OPTIONS = (t, withStartDate) => [
  { value: "", label: t("import.ignoreColumn"), icon: <HiMinusCircle /> },
  { value: "fullName", label: t("student.fullName"), icon: <HiUser /> },
  { value: "phone", label: t("student.phone"), icon: <HiPhone /> },
  { value: "parentPhone", label: t("student.parentPhone"), icon: <HiPhone /> },
  { value: "telegramPhone", label: t("telegramPhone.studentLabel"), icon: <HiPaperAirplane /> },
  { value: "parentTelegramPhone", label: t("telegramPhone.parentLabel"), icon: <HiPaperAirplane /> },
  { value: "price", label: t("student.price"), icon: <HiTag /> },
  { value: "openingBalance", label: t("import.openingDebt"), icon: <HiBanknotes /> },
  ...(withStartDate ? [{ value: "startDate", label: t("import.startDateCol"), icon: <HiCalendarDays /> }] : []),
];

// Ustunni maydonga moslash uchun dropdown. `ui/Select` o'rniga alohida
// yozildi: bu yerda har bandda ikonka, tanlangani uchun ko'k belgi va
// yengilroq vizual og'irlik kerak. `ui/Select` global komponent bo'lgani
// uchun unga tegilmadi (u o'nlab sahifada ishlatiladi).
//
// Menyu `position: fixed` bilan portalsiz emas, balki trigger o'lchamiga
// qarab joylashtiriladi — moslash ro'yxati `overflow-y-auto` ichida
// bo'lgani uchun oddiy `absolute` menyu kesilib qolardi.
function FieldSelect({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const triggerRef = useRef(null);

  const selected = options.find((o) => o.value === value) || options[0];

  const place = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const height = Math.min(options.length * 42 + 12, 280);
    setPos({
      left: r.left,
      width: r.width,
      top: below > height + 12 ? r.bottom + 6 : r.top - height - 6,
      maxHeight: height,
    });
  };

  useEffect(() => {
    if (!open) return;
    place();
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-2 rounded-xl border bg-white dark:bg-night-900 px-3 h-11 text-left transition-colors ${
          open
            ? "border-blue-500 ring-3 ring-blue-100 dark:ring-blue-500/30"
            : "border-slate-200 dark:border-night-700 hover:border-slate-300 dark:hover:border-night-600"
        }`}
      >
        <span className={`text-base shrink-0 ${value ? "text-blue-500" : "text-slate-400 dark:text-slate-500"}`}>
          {selected?.icon}
        </span>
        <span
          className={`flex-1 truncate text-sm ${value ? "text-slate-800 dark:text-slate-100 font-medium" : "text-slate-400 dark:text-slate-500"}`}
        >
          {selected?.label}
        </span>
        <HiChevronDown
          className={`shrink-0 text-slate-400 dark:text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open &&
        pos &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div
              className="fixed z-40 overflow-y-auto rounded-xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 p-1.5 shadow-[0_8px_24px_-6px_rgba(15,23,42,0.15)] dark:shadow-none"
              style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
            >
              {options.map((o) => {
                const active = o.value === value;
                return (
                  <button
                    key={o.value || "none"}
                    type="button"
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-left transition-colors ${
                      active ? "bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 font-medium" : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-night-800"
                    }`}
                  >
                    <span className={`text-base shrink-0 ${active ? "text-blue-500" : "text-slate-400 dark:text-slate-500"}`}>
                      {o.icon}
                    </span>
                    <span className="flex-1 truncate">{o.label}</span>
                    {active && <HiCheck className="shrink-0 text-blue-500" />}
                  </button>
                );
              })}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}

const emptyRow = () => ({
  _key: Math.random().toString(36).slice(2),
  fullName: "",
  phone: "",
  parentPhone: "",
  telegramPhone: "",
  parentTelegramPhone: "",
  price: "",
  openingBalance: "",
  // "YYYY-MM-DD" yoki (o'qib bo'lmagan bo'lsa) xom matn — validatsiyada qizil.
  // Bo'sh — dialogdagi umumiy sana.
  startDate: "",
  existingStudentId: null,
  existingName: "",
});

const guessColumn = (header) => {
  const h = String(header || "").toLowerCase().trim();
  if (TELEGRAM_KEYWORDS.some((kw) => h.includes(kw))) {
    return PARENT_KEYWORDS.some((kw) => h.includes(kw)) ? "parentTelegramPhone" : "telegramPhone";
  }
  for (const key of FIELD_KEYS) {
    if (FIELD_KEYWORDS[key].some((kw) => h.includes(kw))) return key;
  }
  return "";
};

// "1 200 000 so'm" / "1,200,000" kabi matnlarni raqamga tozalaydi.
const cleanNumber = (val) => {
  if (val === null || val === undefined || val === "") return "";
  const s = String(val).replace(/[^\d-]/g, "");
  if (s === "" || s === "-") return "";
  return Number(s);
};

// Excelda telefon har xil yozilgan bo'ladi: "+998931042222", "998931042222",
// "931042222", "93 104 22 22", "(93) 104-22-22", "0931042222" — hammasi
// 9 raqamli ichki formatga keltiriladi.
//
// Mamlakat kodi FAQAT uzunlik uni tasdiqlaganda olib tashlanadi. "998" bilan
// boshlanishi yetarli EMAS: 9 raqamli MAHALLIY raqam ham "998..." bo'lishi
// mumkin (99 — operator kodi, keyingi raqam 8), masalan 998104230. Prefiks
// shartsiz kesilganda bunday raqam 104230 ga aylanib "noto'g'ri" deb rad
// etilardi.
const cleanPhoneDigits = (val) => {
  let s = String(val ?? "").replace(/\D/g, "");
  if (s.length > 9 && s.startsWith("998")) s = s.slice(3);
  return s.slice(-9);
};

// Import qatori uchun Telegram juftligi (§4): bo'sh yoki telefonga teng →
// `*Same: true`, farqli → `*Same: false` + raqam. Taqqoslash oxirgi 9 raqam
// bo'yicha emas, TO'LIQ raqamlar bo'yicha (xorijiy raqam ham bo'lishi mumkin);
// 9 raqamli mahalliy qiymat "+998" bilan to'ldirib solishtiriladi.
const fullDigits = (val) => {
  const d = String(val ?? "").replace(/\D/g, "");
  return d.length === 9 ? `998${d}` : d;
};
const telegramImportFields = (tgRaw, phoneRaw, sameKey, phoneKey) => {
  const tg = cleanTelegramValue(tgRaw);
  // Bo'sh katak — hech narsa yuborilmaydi: yangi o'quvchiga server default
  // (`true`) qo'yadi, MAVJUD o'quvchining saqlangan Telegram raqami esa
  // "bir xil"ga qaytarib yuborilmaydi.
  if (!tg) return {};
  if (fullDigits(tg) === fullDigits(phoneRaw)) return { [sameKey]: true };
  return { [sameKey]: false, [phoneKey]: tg };
};

const pad2 = (n) => String(n).padStart(2, "0");

// Haqiqiy kalendar sanasimi (31.02 kabi qiymatlar rad etiladi)?
const ymd = (y, m, d) => {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${pad2(m)}-${pad2(d)}`;
};

// UTC kun komponentlari: read-excel-file sana katagini UTC yarim tunidagi
// `Date` qilib qaytaradi — mahalliy `getDate()` UTC dan g'arbdagi zonada bir
// kun orqaga siljitardi. Excel kasr xatosi (23:59:59.999) uchun eng yaqin
// kunga yaxlitlanadi.
const DAY_MS = 86400000;
const fromUtcDate = (date) => {
  const rounded = new Date(Math.round(date.getTime() / DAY_MS) * DAY_MS);
  return ymd(rounded.getUTCFullYear(), rounded.getUTCMonth() + 1, rounded.getUTCDate());
};

// Excel/CSV/joylashtirilgan matndagi sanani "YYYY-MM-DD" ga keltiradi:
// `Date`, Excel seriya raqami, `YYYY-MM-DD`, `DD.MM.YYYY`, `DD/MM/YYYY`,
// `DD-MM-YYYY`. O'qib bo'lmasa xom matn qaytadi (jadvalda xato bo'lib
// ko'rinadi), bo'sh bo'lsa — "".
const parseStartDate = (val) => {
  if (val === null || val === undefined || val === "") return "";
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? "" : fromUtcDate(val) || "";
  // Sana formatisiz katak — Excel seriya raqami (1970-01-01 = 25569).
  if (typeof val === "number") {
    if (val > 20000 && val < 80000) return fromUtcDate(new Date((val - 25569) * DAY_MS)) || String(val);
    return String(val);
  }
  const text = String(val).trim();
  if (!text) return "";
  let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return ymd(Number(m[1]), Number(m[2]), Number(m[3])) || text;
  m = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) return ymd(Number(m[3]), Number(m[2]), Number(m[1])) || text;
  return text;
};

// Qator sanasini tekshiradi — xato bo'lsa i18n kaliti, aks holda `null`.
const startDateErrorKey = (value, min) => {
  try {
    assertStartDate(value, min);
    return null;
  } catch (error) {
    return error.message;
  }
};

// `read-excel-file` IKKI XIL shakl qaytaradi va bu oldindan bilinmaydi:
// ba'zan to'g'ridan-to'g'ri qatorlar (`[[...], [...]]`), ba'zan varaqlar
// ro'yxati (`[{ sheet, data: [[...]] }]`). Ilgari faqat birinchisi kutilgan
// edi va ikkinchi holatda `row.map is not a function` xatosi chiqib,
// foydalanuvchi "fayl o'qishda xatolik" xabarini ko'rardi.
//
// Ko'p varaqli kitobda ENG KO'P QATORLI varaq olinadi: Excel fayllarida
// birinchi varaq ko'pincha bo'sh yoki sarlavha bo'ladi, uni olsak import
// bo'sh chiqardi.
const normalizeSheetRows = (parsed) => {
  if (!Array.isArray(parsed) || !parsed.length) return [];

  const rows = Array.isArray(parsed[0])
    ? parsed
    : (() => {
        const sheets = parsed.filter((s) => Array.isArray(s?.data));
        if (!sheets.length) return [];
        return sheets.reduce((best, s) => (s.data.length > best.data.length ? s : best)).data;
      })();

  return rows
    .filter((row) => Array.isArray(row))
    .map((row) => row.map((cell) => (cell === null || cell === undefined ? "" : cell)));
};

function ImportStudentsDialog({ open, onClose, group, subjects = [], onSaved }) {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);
  const [step, setStep] = useState("input"); // input -> mapping -> table
  const [rawTable, setRawTable] = useState([]); // [[cell,...], ...] xom ma'lumot
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState({});
  const [rows, setRows] = useState([]);
  const [pasteText, setPasteText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [lookupCache, setLookupCache] = useState({});
  const lookupTimers = useRef({});
  // Importni bekor qilish (API_CONTRACT_import_undo.md §1-band).
  const [undoOpen, setUndoOpen] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [undone, setUndone] = useState(false);
  // Birinchi bosqichdagi uchta yo'l. "paste" birinchi turadi — nusxa-joylash
  // eng ko'p ishlatiladigan yo'l, fayl tayyorlashdan tez.
  const [inputTab, setInputTab] = useState("paste");
  // Fayl ustiga sudralayotgan payt drop zonasi yonib turadi.
  const [dragging, setDragging] = useState(false);

  const defaultPrice = subjects.find((s) => s._id === group?.subject)?.price ?? "";

  // "O'qishni boshlagan sana" (kontrakt §E) — faqat faol guruhda.
  const startDateOn = group?.status === "active";
  const startDateMin = startDateMinOf(group?.activatedAt);
  const [startDate, setStartDate] = useState(() => tashkentDay());
  const startDateErrKey = startDateOn ? startDateErrorKey(startDate, startDateMin) : null;

  const reset = () => {
    setStep("input");
    setRawTable([]);
    setMapping({});
    setRows([]);
    setPasteText("");
    setResult(null);
    setSubmitting(false);
    setUndoOpen(false);
    setUndone(false);
    setInputTab("paste");
    setDragging(false);
    setStartDate(tashkentDay());
  };

  const handleClose = () => {
    reset();
    onClose?.();
  };

  const parseDelimited = (text) => {
    const lines = text.split(/\r\n|\r|\n/).filter((l) => l.trim() !== "");
    return lines.map((line) => line.split("\t").length > 1 ? line.split("\t") : line.split(","));
  };

  const startMapping = (table) => {
    if (!table.length) {
      errorMsg("import.emptyData");
      return;
    }
    const firstRow = table[0];
    const guesses = firstRow.map((h) => guessColumn(h));
    const looksLikeHeader = guesses.some((g) => g !== "");
    const map = {};
    firstRow.forEach((_, i) => {
      if (guesses[i]) map[i] = guesses[i];
    });
    setHasHeader(looksLikeHeader);
    setMapping(map);
    setRawTable(table);
    setStep("mapping");
  };

  const handlePasteParse = () => {
    if (!pasteText.trim()) return;
    startMapping(parseDelimited(pasteText));
  };

  // Faylni o'qish mantig'i tanlash va sudrab-tashlash (drag & drop) uchun
  // BIR XIL — shuning uchun hodisadan ajratib olindi.
  const processFile = async (file) => {
    if (!file) return;
    const name = file.name.toLowerCase();

    // ESKI `.xls` (binar) formatini `read-excel-file` umuman o'qiy olmaydi —
    // uni ham qabul qilgandek ko'rsatib, keyin tushunarsiz "o'qib bo'lmadi"
    // berish o'rniga aniq aytamiz: faylni `.xlsx` bo'lib saqlash kerak.
    if (name.endsWith(".xls") && !name.endsWith(".xlsx")) {
      errorMsg("import.oldXlsFormat");
      return;
    }

    try {
      let table;
      if (name.endsWith(".csv")) {
        const text = await file.text();
        table = parseDelimited(text);
      } else {
        // read-excel-file — FAYL BRAUZERDA o'qiladi, serverga yuborilmaydi.
        table = normalizeSheetRows(await readXlsxFile(file));
        if (!table.length) {
          errorMsg("import.emptyData");
          return;
        }
      }
      startMapping(table);
    } catch {
      errorMsg("import.fileReadError");
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    // Bir xil faylni ketma-ket ikki marta tanlash ham `change` hodisasini
    // otishi uchun qiymat darhol tozalanadi.
    e.target.value = "";
    await processFile(file);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragging(false);
    await processFile(e.dataTransfer?.files?.[0]);
  };

  // `dragover`da `preventDefault` bo'lmasa brauzer faylni yangi oynada
  // ochib yuboradi va `drop` umuman otilmaydi.
  const handleDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const applyMapping = () => {
    const dataRows = hasHeader ? rawTable.slice(1) : rawTable;
    const colCount = Math.max(...rawTable.map((r) => r.length));
    const colOf = (key) => Object.keys(mapping).find((idx) => mapping[idx] === key);

    const built = dataRows
      .filter((r) => r.some((c) => String(c ?? "").trim() !== ""))
      .slice(0, MAX_ROWS)
      .map((r) => {
        const get = (key) => {
          const idx = colOf(key);
          return idx !== undefined ? r[idx] ?? "" : "";
        };
        return {
          ...emptyRow(),
          fullName: String(get("fullName") ?? "").trim(),
          phone: cleanPhoneDigits(get("phone")),
          parentPhone: String(get("parentPhone") ?? "").trim(),
          telegramPhone: sanitizeTelegramInput(get("telegramPhone")),
          parentTelegramPhone: sanitizeTelegramInput(get("parentTelegramPhone")),
          price: cleanNumber(get("price")),
          openingBalance: cleanNumber(get("openingBalance")),
          startDate: startDateOn ? parseStartDate(get("startDate")) : "",
        };
      });

    void colCount;
    setRows(built.length ? built : [emptyRow()]);
    setStep("table");
  };

  const updateRow = (key, field, value) => {
    setRows((prev) =>
      prev.map((r) =>
        r._key === key
          ? {
              ...r,
              [field]: value,
              ...(field === "phone" ? { existingStudentId: null, existingName: "" } : {}),
            }
          : r,
      ),
    );
  };

  const removeRow = (key) => setRows((prev) => prev.filter((r) => r._key !== key));
  const addRow = () => setRows((prev) => [...prev, emptyRow()]);

  const runLookup = (key, phone) => {
    clearTimeout(lookupTimers.current[key]);
    if (phone.length < 9) return;
    lookupTimers.current[key] = setTimeout(async () => {
      const full = PHONE_PREFIX + phone;
      if (lookupCache[full] !== undefined) return;
      try {
        const res = await api.get("/students/lookup", { params: { phone: full } });
        const { ok, data } = res.data;
        const match = ok && Array.isArray(data) && data.length ? data[0] : null;
        setLookupCache((prev) => ({ ...prev, [full]: match }));
      } catch {
        // jim o'tkaziladi
      }
    }, 400);
  };

  const groupStatus = group?.status;
  const groupActivatedAt = group?.activatedAt;
  const rowErrors = useMemo(() => {
    const phoneCounts = {};
    rows.forEach((r) => {
      const p = r.phone.trim();
      if (p) phoneCounts[p] = (phoneCounts[p] || 0) + 1;
    });
    const map = {};
    rows.forEach((r) => {
      const errs = {};
      if (!r.fullName.trim()) errs.fullName = t("import.errFullName");
      if (!r.phone.trim()) errs.phone = t("import.errPhoneRequired");
      else if (!PHONE_REGEX.test(r.phone.trim())) errs.phone = t("import.errPhoneFormat");
      else if (phoneCounts[r.phone.trim()] > 1) errs.phone = t("import.errPhoneDuplicate");
      if (!isValidTelegramPhone(r.telegramPhone)) errs.telegramPhone = t("telegramPhone.invalidShort");
      if (!isValidTelegramPhone(r.parentTelegramPhone))
        errs.parentTelegramPhone = t("telegramPhone.invalidShort");
      if (groupStatus === "active" && r.startDate) {
        const min = startDateMinOf(groupActivatedAt);
        const key = startDateErrorKey(r.startDate, min);
        if (key) errs.startDate = t(key);
      }
      map[r._key] = errs;
    });
    return map;
  }, [rows, t, groupStatus, groupActivatedAt]);

  // Telegram ustunlari jadvalda faqat moslashda tanlangan yoki qatorlarda
  // qiymat bo'lsa ko'rinadi — aks holda jadval keraksiz kengayib ketardi.
  const showTelegramCols =
    Object.values(mapping).some((v) => v === "telegramPhone" || v === "parentTelegramPhone") ||
    rows.some((r) => r.telegramPhone || r.parentTelegramPhone);

  // Sana ustuni — moslashda tanlangan yoki qatorlarda qiymat bo'lsa.
  const showStartDateCol =
    startDateOn && (Object.values(mapping).includes("startDate") || rows.some((r) => r.startDate));

  const validRows = rows.filter((r) => Object.keys(rowErrors[r._key] || {}).length === 0);
  const invalidCount = rows.length - validRows.length;

  const submit = async () => {
    if (!validRows.length) {
      errorMsg("import.noValidRows");
      return;
    }
    if (startDateErrKey) {
      errorMsg(startDateErrKey);
      return;
    }
    // Faqat bugundan farqli sanalar yuboriladi. Qator sanasi umumiy sanadan
    // ustun: umumiy sana boshqa kun bo'lsa, qatordagi "bugun" ham yuboriladi.
    const today = tashkentDay();
    const commonStartDate = startDateOn && startDate && startDate !== today ? startDate : undefined;
    const effectiveCommon = commonStartDate || today;
    try {
      setSubmitting(true);
      const body = {
        centerId: group.center,
        groupId: group._id,
        ...(commonStartDate ? { startDate: commonStartDate } : {}),
        rows: validRows.map((r) => {
          const full = PHONE_PREFIX + r.phone.trim();
          const match = lookupCache[full];
          const opening = r.openingBalance === "" ? 0 : Number(r.openingBalance);
          const parentPhone = r.parentPhone.trim();
          return {
            fullName: r.fullName.trim(),
            phone: full,
            parentPhone,
            ...telegramImportFields(r.telegramPhone, full, "telegramSame", "telegramPhone"),
            ...telegramImportFields(
              r.parentTelegramPhone,
              parentPhone,
              "parentTelegramSame",
              "parentTelegramPhone",
            ),
            price: r.price === "" ? null : Number(r.price),
            openingBalance: opening ? -Math.abs(opening) : 0,
            existingStudentId: r.existingStudentId || match?._id || null,
            ...(startDateOn && r.startDate && r.startDate !== effectiveCommon ? { startDate: r.startDate } : {}),
          };
        }),
      };
      const res = await api.post("/students/import", body);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);

      setResult(data);
      const created = data?.created ?? 0;
      const enrolled = data?.enrolled ?? 0;
      const skipped = data?.skipped ?? 0;
      const failed = data?.failed ?? 0;
      successMsg(t("import.done", { created, enrolled, skipped, failed }));
      onSaved?.();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const finish = () => {
    handleClose();
  };

  // Import natijasi ekranidan to'g'ridan-to'g'ri bekor qilish (batch yaratilgan
  // bo'lsa, ya'ni created+enrolled > 0). Serverdagi shartlar (24 soat, egasi,
  // to'lov/davomat borligi) `msg` orqali qaytadi.
  const confirmUndo = async () => {
    if (!result?.batchId) return;
    try {
      setUndoing(true);
      const res = await api.post(`/students/import/batches/${result.batchId}/undo`);
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      setUndone(true);
      setUndoOpen(false);
      onSaved?.();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setUndoing(false);
    }
  };

  return (
    <>
    <Dialog
      open={open}
      onClose={handleClose}
      title={
        // `min-w-0` + matn o'ralishi: umumiy `Dialog` ning h3 elementida
        // `min-w-0` yo'q, shuning uchun `truncate` ishlatilsa sarlavha tor
        // ekranda qisqarmay yopish tugmasini siqib chiqarardi.
        <span className="flex items-center gap-3 min-w-0">
          <span className="shrink-0 size-10 rounded-xl bg-blue-50 dark:bg-blue-500/15 text-blue-500 grid place-items-center text-xl">
            <HiTableCells />
          </span>
          <span className="flex flex-col min-w-0">
            <span className="text-base sm:text-xl font-semibold text-slate-800 dark:text-slate-100 leading-tight">
              {t("import.title")}
            </span>
            {step === "mapping" && !result && (
              <span className="text-xs sm:text-[13px] font-normal text-slate-500 dark:text-slate-400 leading-tight">
                {t("import.mappingHint")}
              </span>
            )}
          </span>
        </span>
      }
      // Qo'shimcha ustunlar (Telegram / boshlagan sana) bo'lsa jadval kesilmasin.
      className={`md:w-[95vw] ${showTelegramCols || showStartDateCol ? "md:max-w-6xl" : "md:max-w-4xl"}`}
      actions={
        result ? (
          <>
            {result.batchId && !undone && (
              <Button
                color="red"
                variant="text"
                className="gap-1.5"
                onClick={() => setUndoOpen(true)}
              >
                <HiArrowUturnLeft /> {t("import.undoButton")}
              </Button>
            )}
            <Button onClick={finish}>{t("common.close")}</Button>
          </>
        ) : step === "table" ? (
          <>
            <Button color="black" variant="text" onClick={handleClose}>
              {t("common.cancel")}
            </Button>
            <Button onClick={addRow} color="slate" variant="outlined" className="gap-1">
              <HiPlus /> {t("import.addRow")}
            </Button>
            <Button loading={submitting} disabled={!validRows.length} onClick={submit}>
              {t("import.submit", { count: validRows.length })}
            </Button>
          </>
        ) : step === "mapping" ? (
          <>
            <Button color="black" variant="text" onClick={handleClose}>
              {t("common.cancel")}
            </Button>
            <Button onClick={applyMapping}>{t("common.next")}</Button>
          </>
        ) : (
          <>
            <Button color="black" variant="text" onClick={handleClose}>
              {t("common.cancel")}
            </Button>
            {/* "Keyingi" faqat joylashtirish tabida ma'noga ega: fayl
                tanlansa keyingi bosqichga o'zi o'tadi, "Ko'chirish
                xizmati"da esa davom ettiradigan narsa yo'q. */}
            {inputTab === "paste" && (
              <Button disabled={!pasteText.trim()} onClick={handlePasteParse}>
                {t("common.next")}
              </Button>
            )}
          </>
        )
      }
    >
      {result ? (
        <div className="flex flex-col gap-3 items-center py-6 text-center">
          <HiCheckCircle className="text-5xl text-emerald-500" />
          <p className="text-slate-800 dark:text-slate-100 font-semibold">
            {t("import.done", {
              created: result.created ?? 0,
              enrolled: result.enrolled ?? 0,
              skipped: result.skipped ?? 0,
              failed: result.failed ?? 0,
            })}
          </p>
          {Array.isArray(result.results) && result.results.some((r) => !r.ok) && (
            <div className="flex flex-col gap-1 w-full text-left mt-2 max-h-48 overflow-y-auto">
              {result.results
                .filter((r) => !r.ok)
                .map((r) => (
                  <p key={r.index} className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
                    <HiExclamationTriangle className="shrink-0" />
                    {t("import.rowLabel", { index: r.index + 1 })}: {t(r.error, { defaultValue: r.error })}
                  </p>
                ))}
            </div>
          )}
          {undone && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <HiCheckCircle className="shrink-0" /> {t("import.undone")}
            </p>
          )}
        </div>
      ) : step === "input" ? (
        <div className="flex flex-col gap-4">
          {/* Uchta mustaqil yo'l — ilgari hammasi bitta ustunda ustma-ust
              turardi va oyna cho'zilib ketardi. Tab uslubi GroupDetail'dagi
              o'quvchilar tablari bilan bir xil (umumiy `ui/` komponenti yo'q,
              shu sabab lokal takrorlanadi). */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-night-800 overflow-x-auto">
            {[
              // Mobilda qisqa yorliq: to'liq uchtasi 390px ekranga sig'maydi
              // (351px kerak, 326px bor) va uchinchisi ko'rinmay qolardi.
              { key: "paste", label: t("import.tabPaste"), short: t("import.tabPasteShort"), icon: <HiTableCells /> },
              { key: "file", label: t("import.tabFile"), short: t("import.tabFileShort"), icon: <HiArrowUpTray /> },
              { key: "help", label: t("import.tabHelp"), short: t("import.tabHelpShort"), icon: <HiPaperAirplane /> },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setInputTab(tab.key)}
                className={`flex items-center justify-center gap-1.5 shrink-0 px-2.5 sm:px-3 h-8 rounded-lg text-[12px] sm:text-[13px] font-semibold whitespace-nowrap cursor-pointer transition-colors duration-150 ${
                  inputTab === tab.key
                    ? "bg-white dark:bg-night-900 text-slate-900 dark:text-slate-100 shadow-sm dark:shadow-none"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                <span className="shrink-0">{tab.icon}</span>
                <span className="sm:hidden">{tab.short}</span>
                <span className="hidden sm:block">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Fayl inputi tabdan tashqarida — "Ko'chirish xizmati" tabiga
              o'tib qaytilganda ref yo'qolmasligi uchun. */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleFile}
          />

          {/* Barcha tablar uchun bir xil minimal balandlik: almashganda
              oyna sakramaydi. */}
          <div className="min-h-62.5">
            {inputTab === "paste" && (
              <div className="flex flex-col gap-1.5">
                <span className="pl-2 text-sm text-slate-800 dark:text-slate-100">{t("import.pasteLabel")}</span>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={t("import.pastePlaceholder")}
                  rows={7}
                  className="w-full rounded-lg border border-slate-200 dark:border-night-700 bg-slate-100 dark:bg-night-800 p-3 text-[13px] text-slate-800 dark:text-slate-100 outline-none focus:ring-3 focus:ring-blue-100 dark:focus:ring-blue-500/30 focus:border-blue-500 resize-none"
                />
                <p className="pl-2 text-xs text-slate-400 dark:text-slate-500">{t("import.pasteHint")}</p>
                <p className="pl-2 text-xs text-slate-400 dark:text-slate-500">{t("import.telegramColumnsHint")}</p>
              </div>
            )}

            {inputTab === "file" && (
              <div className="flex flex-col gap-2">
                {/* Butun zona bitta `button` — ichida yana tugma bo'lsa
                    bosish ikkala eshituvchiga ham yetib, fayl oynasi ikki
                    marta ochilardi. */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  className={`flex flex-col items-center justify-center gap-3 w-full px-6 py-10 rounded-xl border-2 border-dashed cursor-pointer transition-colors duration-150 ${
                    dragging
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-500/15"
                      : "border-slate-200 dark:border-night-700 bg-slate-50 dark:bg-night-800 hover:border-blue-300 hover:bg-blue-50/40 dark:hover:bg-blue-500/15"
                  }`}
                >
                  <span
                    className={`grid place-items-center size-12 rounded-2xl text-2xl transition-colors duration-150 ${
                      dragging ? "bg-blue-500 text-white" : "bg-white dark:bg-night-900 text-blue-500 shadow-sm dark:shadow-none"
                    }`}
                  >
                    <HiArrowUpTray />
                  </span>
                  <span className="flex flex-col items-center gap-1 text-center">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {t("import.dropTitle")}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">{t("import.dropFormats")}</span>
                  </span>
                  {/* `import.chooseFile` kengaytmalarni ham o'z ichiga oladi —
                      bu yerda ular yuqorida allaqachon yozilgani uchun qisqa
                      variant ishlatiladi. */}
                  <span className="text-[13px] font-semibold text-blue-500">
                    {t("import.dropBrowse")}
                  </span>
                </button>
                <p className="pl-2 text-xs text-slate-400 dark:text-slate-500">{t("import.fileHint")}</p>
                <p className="pl-2 text-xs text-slate-400 dark:text-slate-500">{t("import.telegramColumnsHint")}</p>
              </div>
            )}

            {inputTab === "help" && (
              <div className="flex flex-col gap-4 pl-2 pt-1">
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {t("import.helpTitle")}
                  </span>
                  <p className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {t("import.helpDesc")}
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  {["helpPointStudents", "helpPointDebt", "helpPointFormat"].map((key) => (
                    <span key={key} className="flex items-start gap-2 text-[13px] text-slate-600 dark:text-slate-300">
                      <HiCheckCircle className="shrink-0 mt-0.5 text-emerald-500" />
                      {t(`import.${key}`)}
                    </span>
                  ))}
                </div>

                {/* `ui/Button` <button> render qiladi, bu esa havola bo'lishi
                    kerak — shuning uchun tugma ko'rinishi shu yerda lokal. */}
                <a
                  href={`https://t.me/${import.meta.env.VITE_SUPPORT_TELEGRAM || "Saidweb"}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex self-start items-center gap-2 h-11 px-4 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold transition-colors duration-150"
                >
                  <HiPaperAirplane className="shrink-0" />
                  {t("import.helpCta")}
                </a>

                <p className="text-xs text-slate-400 dark:text-slate-500">{t("import.helpNote")}</p>
              </div>
            )}
          </div>
        </div>
      ) : step === "mapping" ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 max-h-[52vh] overflow-y-auto -mx-1 px-1">
            {(rawTable[0] || []).map((header, idx) => {
              // Ko'rib turish uchun namuna qiymat: birinchi qator sarlavha
              // bo'lsa keyingi qatordan, bo'lmasa o'sha qatorning o'zidan.
              const sample = String((hasHeader ? rawTable[1] : rawTable[0])?.[idx] ?? "").trim();
              const mapped = !!mapping[idx];
              return (
                <div
                  key={idx}
                  className={`grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,15rem)] items-center gap-3 rounded-[14px] border p-3 transition-colors ${
                    mapped ? "border-slate-200 dark:border-night-700 bg-white dark:bg-night-900" : "border-slate-200 dark:border-night-700 bg-slate-50/60 dark:bg-night-800/60"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`shrink-0 size-7 rounded-full grid place-items-center text-xs font-semibold ${
                        mapped ? "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400" : "bg-slate-200/70 dark:bg-night-700/70 text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        {hasHeader && String(header ?? "").trim()
                          ? String(header).trim()
                          : t("import.column", { index: idx + 1 })}
                      </span>
                      <span className="text-sm text-slate-800 dark:text-slate-100 font-medium truncate">
                        {sample || "—"}
                      </span>
                    </div>
                  </div>

                  <HiArrowRight className="hidden sm:block shrink-0 text-slate-300 dark:text-slate-600" />

                  <FieldSelect
                    value={mapping[idx] || ""}
                    onChange={(v) => setMapping((prev) => ({ ...prev, [idx]: v }))}
                    options={FIELD_OPTIONS(t, startDateOn)}
                  />
                </div>
              );
            })}
          </div>

          <label className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-300 cursor-pointer select-none">
            <span className="relative grid place-items-center">
              <input
                type="checkbox"
                checked={hasHeader}
                onChange={(e) => setHasHeader(e.target.checked)}
                className="peer appearance-none size-5 rounded-md border border-slate-300 dark:border-night-600 bg-white dark:bg-night-900 transition-colors checked:bg-blue-500 checked:border-blue-500 focus-visible:ring-3 focus-visible:ring-blue-100 dark:focus-visible:ring-blue-500/30 outline-none cursor-pointer"
              />
              <HiCheck className="pointer-events-none absolute text-white text-sm opacity-0 peer-checked:opacity-100" />
            </span>
            {t("import.firstRowIsHeader")}
            <HiInformationCircle
              className="text-slate-300 dark:text-slate-600 hover:text-slate-400 dark:hover:text-slate-500 transition-colors"
              title={t("import.headerHint")}
            />
          </label>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {startDateOn && (
            <div className="flex flex-col gap-1 w-full sm:max-w-xs">
              <StartDateField
                value={startDate}
                onChange={setStartDate}
                min={startDateMin}
                error={startDateErrKey ? t(startDateErrKey) : undefined}
              />
              {showStartDateCol && (
                <p className="pl-2 text-[11px] leading-snug text-slate-400 dark:text-slate-500">{t("import.startDateRowHint")}</p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 flex-wrap gap-1">
            <span>{t("import.rowsCount", { count: rows.length })}</span>
            {invalidCount > 0 && (
              <span className="text-red-500 flex items-center gap-1">
                <HiExclamationTriangle /> {t("import.invalidCount", { count: invalidCount })}
              </span>
            )}
          </div>

          <div className="w-full overflow-x-auto rounded-lg border border-slate-200 dark:border-night-700">
            {/* Kenglik ko'rinadigan ixtiyoriy ustunlarga qarab (Telegram +300, sana +160). */}
            <table
              className="w-full text-[13px]"
              style={{ minWidth: 820 + (showTelegramCols ? 300 : 0) + (showStartDateCol ? 176 : 0) }}
            >
              <thead>
                <tr className="bg-slate-50 dark:bg-night-800 text-slate-500 dark:text-slate-400 text-xs">
                  <th className="text-left px-2 py-2 font-medium">{t("student.fullName")}</th>
                  <th className="text-left px-2 py-2 font-medium">{t("student.phone")}</th>
                  <th className="text-left px-2 py-2 font-medium">{t("student.parentPhone")}</th>
                  {showTelegramCols && (
                    <>
                      <th className="text-left px-2 py-2 font-medium">{t("import.studentTelegramCol")}</th>
                      <th className="text-left px-2 py-2 font-medium">{t("import.parentTelegramCol")}</th>
                    </>
                  )}
                  <th className="text-left px-2 py-2 font-medium w-28">{t("student.price")}</th>
                  <th className="text-left px-2 py-2 font-medium w-32">{t("import.openingDebt")}</th>
                  {showStartDateCol && (
                    <th className="text-left px-2 py-2 font-medium w-44">{t("import.startDateCol")}</th>
                  )}
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const errs = rowErrors[r._key] || {};
                  const match = lookupCache[PHONE_PREFIX + r.phone.trim()];
                  return (
                    <tr key={r._key} className="border-t border-slate-100 dark:border-night-700 align-top">
                      <td className="p-1.5">
                        <input
                          value={r.fullName}
                          onChange={(e) => updateRow(r._key, "fullName", e.target.value)}
                          className={`w-full min-w-[140px] h-9 px-2 rounded-md border bg-white dark:bg-night-900 outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/30 ${
                            errs.fullName ? "border-red-400" : "border-slate-200 dark:border-night-700"
                          }`}
                        />
                        {errs.fullName && <p className="text-[11px] text-red-500 mt-0.5">{errs.fullName}</p>}
                      </td>
                      <td className="p-1.5">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">+998</span>
                          <input
                            value={r.phone}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, "").slice(0, 9);
                              updateRow(r._key, "phone", digits);
                              runLookup(r._key, digits);
                            }}
                            className={`w-full min-w-[100px] h-9 px-2 rounded-md border bg-white dark:bg-night-900 outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/30 ${
                              errs.phone ? "border-red-400" : "border-slate-200 dark:border-night-700"
                            }`}
                          />
                        </div>
                        {errs.phone && <p className="text-[11px] text-red-500 mt-0.5">{errs.phone}</p>}
                        {!errs.phone && match && (
                          <button
                            type="button"
                            onClick={() =>
                              updateRow(r._key, "existingStudentId", r.existingStudentId ? null : match._id)
                            }
                            className={`mt-0.5 flex items-center gap-1 text-[11px] cursor-pointer ${
                              r.existingStudentId ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-blue-500 underline"
                            }`}
                          >
                            <HiUser className="shrink-0" />
                            {r.existingStudentId
                              ? t("import.linkedTo", { name: match.fullName })
                              : t("import.sameStudentQuestion", { name: match.fullName })}
                          </button>
                        )}
                      </td>
                      <td className="p-1.5">
                        <input
                          value={r.parentPhone}
                          onChange={(e) => updateRow(r._key, "parentPhone", e.target.value)}
                          className="w-full min-w-[120px] h-9 px-2 rounded-md border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/30"
                        />
                      </td>
                      {showTelegramCols &&
                        ["telegramPhone", "parentTelegramPhone"].map((field) => (
                          <td key={field} className="p-1.5">
                            <input
                              value={r[field]}
                              placeholder="+998..."
                              onChange={(e) => updateRow(r._key, field, sanitizeTelegramInput(e.target.value))}
                              className={`w-full min-w-[130px] h-9 px-2 rounded-md border bg-white dark:bg-night-900 outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/30 ${
                                errs[field] ? "border-red-400" : "border-slate-200 dark:border-night-700"
                              }`}
                            />
                            {errs[field] && <p className="text-[11px] text-red-500 mt-0.5">{errs[field]}</p>}
                          </td>
                        ))}
                      <td className="p-1.5">
                        <input
                          value={r.price}
                          placeholder={String(defaultPrice ?? "")}
                          onChange={(e) => updateRow(r._key, "price", cleanNumber(e.target.value))}
                          className="w-full min-w-[100px] h-9 px-2 rounded-md border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/30"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          value={r.openingBalance}
                          onChange={(e) => updateRow(r._key, "openingBalance", cleanNumber(e.target.value))}
                          className="w-full min-w-[100px] h-9 px-2 rounded-md border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/30"
                        />
                      </td>
                      {showStartDateCol && (
                        <td className="p-1.5">
                          {/* Bo'sh — umumiy sana. O'qib bo'lmagan xom matn
                              date input'da ko'rinmaydi — xato ostida chiqadi. */}
                          <input
                            type="date"
                            value={/^\d{4}-\d{2}-\d{2}$/.test(r.startDate) ? r.startDate : ""}
                            min={startDateMin}
                            max={tashkentDay()}
                            onChange={(e) => updateRow(r._key, "startDate", e.target.value)}
                            className={`w-full min-w-[140px] h-9 px-2 rounded-md border bg-white dark:bg-night-900 outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/30 ${
                              errs.startDate ? "border-red-400 bg-red-50 dark:bg-red-500/10" : "border-slate-200 dark:border-night-700"
                            }`}
                          />
                          {errs.startDate && (
                            <p className="text-[11px] text-red-500 mt-0.5">
                              {errs.startDate}
                              {!/^\d{4}-\d{2}-\d{2}$/.test(r.startDate) && ` (${r.startDate})`}
                            </p>
                          )}
                        </td>
                      )}
                      <td className="p-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => removeRow(r._key)}
                          className="text-slate-400 dark:text-slate-500 hover:text-red-500 cursor-pointer"
                        >
                          <HiTrash />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Dialog>

    {/* Importni bekor qilish tasdiq modali — asosiy Dialog ustidan chiqadi. */}
    <Dialog
      open={undoOpen}
      onClose={() => setUndoOpen(false)}
      title={t("import.undoTitle")}
      actions={
        <>
          <Button color="black" variant="text" onClick={() => setUndoOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button color="red" loading={undoing} onClick={confirmUndo}>
            {t("import.undoButton")}
          </Button>
        </>
      }
    >
      <p>
        {t("import.undoConfirm", {
          count: (result?.created ?? 0) + (result?.enrolled ?? 0),
        })}
      </p>
    </Dialog>
    </>
  );
}

export default ImportStudentsDialog;
