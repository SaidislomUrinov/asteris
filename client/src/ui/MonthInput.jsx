import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { HiCalendarDays, HiChevronLeft, HiChevronRight } from "react-icons/hi2";

const POPOVER_WIDTH = 260;

const parse = (v) => {
  const [y, m] = String(v || "").split("-").map(Number);
  return { year: y || new Date().getFullYear(), monthIndex: (m || new Date().getMonth() + 1) - 1 };
};

const format = (year, monthIndex) => `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

/**
 * Oy tanlovi — native `<input type="month">` o'rniga. Native maydon har
 * brauzerda boshqacha ko'rinadi (Chrome'da kulrang spinner, Firefox'da
 * umuman kalendar yo'q) va loyiha dizayn tiliga mos kelmasdi.
 *
 * Trigger va popover `DateRangeInput` bilan bir xil: h-11, rounded-xl,
 * fokusda `ring-3`, popover `createPortal` orqali `document.body` ga.
 *
 * @param {Object} props
 * @param {string} props.value - "YYYY-MM"
 * @param {(month: string) => void} props.onChange
 * @param {string} [props.max] - "YYYY-MM", shu oydan keyingilari bloklanadi
 * @param {"slate"|"white"} [props.variant="slate"]
 * @param {string} [props.className]
 */
function MonthInput({ value, onChange, max, variant = "slate", className = "" }) {
  const { t } = useTranslation();
  const triggerRef = useRef(null);
  const popRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const { year, monthIndex } = parse(value);
  // Popover ichida ko'rilayotgan yil — tanlangan qiymatdan mustaqil (yillar
  // bo'ylab yurib, keyin oy bosiladi). `null` = hali surilmagan, tanlangan
  // yil ko'rsatiladi; popover har ochilganda handler'da qaytadan `null` ga
  // tushadi, shu sabab sinxronlash uchun effect kerak emas.
  const [shiftedYear, setShiftedYear] = useState(null);
  const viewYear = shiftedYear ?? year;
  const setViewYear = (fn) => setShiftedYear((prev) => fn(prev ?? year));

  const months = t("common.monthNames", { returnObjects: true }) || [];
  const label = Array.isArray(months) && months[monthIndex] ? `${months[monthIndex]} ${year}` : value;

  const calcPos = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const height = 280;
    const openUpward = window.innerHeight - rect.bottom < height && rect.top > height;
    setPos({
      top: openUpward ? undefined : rect.bottom + 6,
      bottom: openUpward ? window.innerHeight - rect.top + 6 : undefined,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - POPOVER_WIDTH - 8)),
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
  }, [open]);

  const variants = {
    slate: "bg-white border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
    white: "bg-white border-slate-200",
  };

  const maxYear = max ? Number(max.slice(0, 4)) : null;
  const maxMonth = max ? Number(max.slice(5, 7)) - 1 : null;
  const isDisabled = (i) => max && (viewYear > maxYear || (viewYear === maxYear && i > maxMonth));

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div
        ref={triggerRef}
        onClick={() => {
          if (!open) {
            calcPos();
            setShiftedYear(null);
          }
          setOpen((p) => !p);
        }}
        className={`relative w-full h-11 rounded-xl flex items-center gap-2 px-3.5 border select-none cursor-pointer duration-200 ${
          variants[variant]
        } ${open ? "ring-3 ring-blue-500/15 border-blue-500" : "hover:border-slate-300"}`}
      >
        <HiCalendarDays className="shrink-0 text-slate-400" />
        <span className="truncate text-[13px] text-slate-900 capitalize">{label}</span>
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
              width: POPOVER_WIDTH,
              zIndex: 9999,
            }}
            className="flex flex-col gap-2 p-2 rounded-2xl bg-white border border-slate-200 shadow-xl"
          >
            <div className="flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={() => setViewYear((y) => y - 1)}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700 cursor-pointer transition-colors"
              >
                <HiChevronLeft />
              </button>
              <span className="text-[13px] font-semibold text-slate-800 tabular-nums">{viewYear}</span>
              <button
                type="button"
                disabled={maxYear !== null && viewYear >= maxYear}
                onClick={() => setViewYear((y) => y + 1)}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 enabled:hover:bg-slate-50 enabled:hover:text-slate-700 enabled:cursor-pointer disabled:opacity-30 transition-colors"
              >
                <HiChevronRight />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1">
              {(Array.isArray(months) ? months : []).map((name, i) => {
                const active = viewYear === year && i === monthIndex;
                return (
                  <button
                    key={name}
                    type="button"
                    disabled={isDisabled(i)}
                    onClick={() => {
                      onChange(format(viewYear, i));
                      setOpen(false);
                    }}
                    className={`h-9 rounded-lg text-[13px] capitalize transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                      active
                        ? "bg-blue-50 text-blue-700 font-semibold"
                        : "text-slate-600 enabled:hover:bg-slate-50 enabled:cursor-pointer"
                    }`}
                  >
                    {name.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export default MonthInput;
