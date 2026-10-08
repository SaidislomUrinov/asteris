import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { HiCalendarDays, HiXMark } from "react-icons/hi2";
import { DayPicker } from "react-day-picker";
import { uz } from "date-fns/locale/uz";
import useMediaQuery from "../hooks/useMediaQuery";
import "react-day-picker/style.css";

// Sana API'ga "YYYY-MM-DD" ko'rinishida ketadi. `toISOString()` UTC'ga
// o'tkazib yuboradi (Toshkentda kechqurun tanlangan sana bir kun orqaga
// siljib qolardi), shuning uchun qo'lda yig'iladi.
const toISO = (d) =>
  d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "";

const fromISO = (s) => {
  if (!s) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
};

const human = (d) =>
  d ? `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}` : "";

const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/**
 * "Dan — gacha" oralig'i uchun BITTA maydon (react-day-picker asosida).
 *
 * Ikki alohida `type="date"` input o'rniga bitta trigger: bosilganda
 * kalendar ochiladi (katta ekranda 2 oy yonma-yon), chapda esa tez tanlash
 * tugmalari — "Bugun", "7 kun", "Shu oy"...
 *
 * Qiymat tashqariga API kutgan formatda beriladi: `{ from, to }` — ikkalasi
 * ham "YYYY-MM-DD" satr yoki bo'sh satr.
 *
 * @param {Object} props
 * @param {{from: string, to: string}} props.value
 * @param {(v: {from: string, to: string}) => void} props.onChange
 * @param {string} [props.placeholder]
 * @param {"slate"|"white"} [props.variant="slate"]
 */
function DateRangeInput({ value, onChange, placeholder, variant = "slate", className = "" }) {
  const { t } = useTranslation();
  const wide = useMediaQuery("(min-width: 768px)");
  const triggerRef = useRef(null);
  const popRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, openUpward: false });

  const selected = useMemo(
    () => ({ from: fromISO(value?.from), to: fromISO(value?.to) }),
    [value?.from, value?.to],
  );

  const variants = {
    slate: "bg-white dark:bg-night-900 border-slate-200 dark:border-night-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none",
    white: "bg-white dark:bg-night-900 border-slate-200 dark:border-night-700",
    // Faqat FilterBar ichida: Select bilan bir xil — qiymat tanlanganda
    // ochiq ko'k fon bilan ajralib turadi.
    filter: "bg-white dark:bg-night-900 border-slate-200 dark:border-night-700",
  };

  const label = selected.from
    ? `${human(selected.from)}${selected.to ? ` — ${human(selected.to)}` : ""}`
    : "";

  const calcPos = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = wide ? 620 : 320;
    const height = 380;
    const openUpward = window.innerHeight - rect.bottom < height && rect.top > height;
    setPos({
      top: openUpward ? undefined : rect.bottom + 6,
      bottom: openUpward ? window.innerHeight - rect.top + 6 : undefined,
      // O'ng chetdan chiqib ketmasin
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      width,
      openUpward,
    });
  };

  useEffect(() => {
    if (!open) return;
    const outside = (e) => {
      if (triggerRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", esc);
    window.addEventListener("resize", calcPos);
    window.addEventListener("scroll", calcPos, true);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("resize", calcPos);
      window.removeEventListener("scroll", calcPos, true);
    };
    // `calcPos` har renderda yangi funksiya, lekin u faqat `wide` ga
    // bog'liq — shuning uchun tinglovchilar shu ikkisiga qarab ulanadi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, wide]);

  const apply = (range) => onChange({ from: toISO(range?.from), to: toISO(range?.to) });

  const today = new Date();
  const presets = [
    { key: "today", range: { from: today, to: today } },
    { key: "last7", range: { from: addDays(today, -6), to: today } },
    { key: "last30", range: { from: addDays(today, -29), to: today } },
    { key: "thisMonth", range: { from: startOfMonth(today), to: today } },
    {
      key: "prevMonth",
      range: {
        from: startOfMonth(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
        to: endOfMonth(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
      },
    },
    { key: "thisYear", range: { from: new Date(today.getFullYear(), 0, 1), to: today } },
  ];

  const activePreset = presets.find(
    (p) => toISO(p.range.from) === value?.from && toISO(p.range.to) === value?.to,
  )?.key;

  return (
    <div className={`flex flex-col gap-1 w-full ${className}`}>
      <div
        ref={triggerRef}
        onClick={() => {
          if (!open) calcPos();
          setOpen((p) => !p);
        }}
        className={`select-trigger relative w-full h-11 rounded-xl flex items-center justify-between gap-2 px-3.5 border select-none cursor-pointer duration-200 ${
          variants[variant]
        } ${variant === "filter" && label ? "!bg-blue-50 dark:bg-blue-500/15 !border-blue-200 dark:border-blue-500/30 hover:!border-blue-300" : ""} ${
          open ? "ring-3 ring-blue-500/15 border-blue-500" : "hover:border-slate-300 dark:hover:border-night-600"
        }`}
      >
        <span className="flex items-center gap-2 min-w-0">
          <HiCalendarDays className="shrink-0 text-slate-400 dark:text-slate-500" />
          <span
            className={`truncate text-[13px] ${label ? "text-slate-900 dark:text-slate-100" : "text-slate-400 dark:text-slate-500"} ${
              variant === "filter" && label ? "font-medium text-blue-700 dark:text-blue-400" : ""
            }`}
          >
            {label || placeholder || t("common.dateRange")}
          </span>
        </span>
        {label && (
          <span
            role="button"
            title={t("common.resetFilters")}
            onClick={(e) => {
              e.stopPropagation();
              onChange({ from: "", to: "" });
              setOpen(false);
            }}
            className="flex items-center justify-center w-6 h-6 shrink-0 rounded-lg text-slate-400 dark:text-slate-500 hover:bg-slate-200/70 dark:hover:bg-night-700/70 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <HiXMark />
          </span>
        )}
      </div>

      {open &&
        createPortal(
          <div
            ref={popRef}
            style={{
              position: "fixed",
              top: pos.top,
              bottom: pos.bottom,
              left: pos.left,
              zIndex: 9999,
            }}
            className="flex flex-col sm:flex-row gap-2 p-2 rounded-2xl bg-white dark:bg-night-900 border border-slate-200 dark:border-night-700 shadow-xl dark:shadow-none"
          >
            {/* Tez tanlash — eng ko'p kerak bo'ladigan oraliqlar */}
            <div className="flex sm:flex-col gap-1 sm:w-36 overflow-x-auto sm:overflow-visible">
              {presets.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => {
                    apply(p.range);
                    setOpen(false);
                  }}
                  className={`shrink-0 px-2.5 h-8 rounded-lg text-[13px] font-medium text-left whitespace-nowrap transition-colors duration-150 cursor-pointer ${
                    activePreset === p.key
                      ? "bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-night-800"
                  }`}
                >
                  {t(`common.datePresets.${p.key}`)}
                </button>
              ))}
            </div>

            <span className="hidden sm:block w-px bg-slate-100 dark:bg-night-800" />

            <div className="rdp-asteris">
              <DayPicker
                mode="range"
                locale={uz}
                numberOfMonths={wide ? 2 : 1}
                defaultMonth={selected.from || today}
                selected={selected.from ? selected : undefined}
                onSelect={(range) => apply(range)}
                showOutsideDays
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export default DateRangeInput;
