import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HiChevronDown } from "react-icons/hi2";

function Select({
  value = "",
  onChange = () => {},
  label = "",
  required = false,
  disabled = false,
  placeholder = "Select...",
  className = "",
  options = [],
  color = "blue",
  variant = "slate",
  icon = null,
}) {
  const colors = {
    emerald: "ring-emerald-500/15",
    blue: "ring-blue-500/15",
    black: "ring-slate-900/10",
    red: "ring-red-500/15",
    orange: "ring-orange-500/15",
    yellow: "ring-yellow-500/20",
    slate: "ring-slate-500/15",
  };

  const openBorderColors = {
    emerald: "border-emerald-500",
    blue: "border-blue-500",
    black: "border-slate-900",
    red: "border-red-500",
    orange: "border-orange-500",
    yellow: "border-yellow-500",
    slate: "border-slate-500",
  };

  const selectedItemColors = {
    emerald: "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    blue: "bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400",
    black: "bg-slate-100 dark:bg-night-800 text-slate-900 dark:text-slate-100",
    red: "bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-400",
    orange: "bg-orange-50 dark:bg-orange-500/15 text-orange-700 dark:text-orange-400",
    yellow: "bg-yellow-50 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
    slate: "bg-slate-100 dark:bg-night-800 text-slate-700 dark:text-slate-300",
  };

  // Qiymat tanlanganda maydon avval butunlay rangga bo'yalardi; yangi dizaynda
  // u oq qoladi (qatordagi barcha maydonlar bir xil ko'rinadi) va tanlangani
  // faqat matnning to'qligi bilan ajralib turadi — shu sabab alohida
  // "active trigger" ranglari kerak emas.
  const variants = {
    slate: "bg-white dark:bg-night-900 border-slate-200 dark:border-night-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none",
    white: "bg-white dark:bg-night-900 border-slate-200 dark:border-night-700",
    // Faqat FilterBar ichida ishlatiladi: bo'sh bo'lganda oddiy oq, qiymat
    // tanlanganda ochiq ko'k fon bilan ajralib turadi — foydalanuvchi qaysi
    // filtrlar faol ekanini qatorga qarab darhol ko'radi.
    filter: "bg-white dark:bg-night-900 border-slate-200 dark:border-night-700",
  };

  const filterSelectedClasses =
    "!bg-blue-50 dark:bg-blue-500/15 !border-blue-200 dark:border-blue-500/30 hover:!border-blue-300";
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(value);
  const [pos, setPos] = useState({
    top: 0,
    left: 0,
    width: 0,
    maxHeight: 240,
    openUpward: false,
  });

  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  // Tashqi `value` o'zgarsa — render fazasida sinxronlanadi (effect emas).
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setSelected(value);
  }

  const calcPos = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const GAP = 4;
    const spaceBelow = window.innerHeight - rect.bottom - GAP;
    const spaceAbove = rect.top - GAP;
    const maxDropH = Math.min(window.innerHeight * 0.4, 260);
    const openUpward = spaceBelow < 160 && spaceAbove > spaceBelow;

    setPos({
      width: rect.width,
      left: rect.left,
      top: openUpward ? undefined : rect.bottom + GAP,
      bottom: openUpward ? window.innerHeight - rect.top + GAP : undefined,
      maxHeight: openUpward
        ? Math.min(maxDropH, spaceAbove)
        : Math.min(maxDropH, spaceBelow),
      openUpward,
    });
  };

  const handleOpen = () => {
    if (disabled) return;
    if (!open) calcPos();
    setOpen((p) => !p);
  };

  const handleSelect = (option) => {
    setSelected(option.value);
    onChange(option.value);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;

    const handleOutside = (e) => {
      if (
        triggerRef.current?.contains(e.target) ||
        dropdownRef.current?.contains(e.target)
      )
        return;
      setOpen(false);
    };

    const handleScroll = (e) => {
      // Dropdown ichida scroll bo'lsa yopmasin
      if (dropdownRef.current?.contains(e.target)) return;
      calcPos();
    };

    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", calcPos);

    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", calcPos);
    };
  }, [open]);

  return (
    <div className={`flex flex-col gap-1 w-full min-w-[100px] ${className}`}>
      {label && (
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
          {label} {required && <span className="text-rose-500">*</span>}
        </span>
      )}

      <div
        ref={triggerRef}
        onClick={handleOpen}
        className={`select-trigger relative w-full h-11 rounded-xl flex items-center transition-colors duration-200 justify-between border select-none ${icon ? "pl-3.5 pr-3" : "px-3.5"} ${
          variants[variant]
        } ${
          disabled
            ? "bg-slate-50 dark:bg-night-800 border-slate-200 dark:border-night-700 shadow-none cursor-not-allowed"
            : `cursor-pointer hover:border-slate-300 dark:hover:border-night-600`
        } ${variant === "filter" && selected ? filterSelectedClasses : ""} ${open ? `ring-3 ${colors[color]} ${openBorderColors[color]}` : ""}`}
      >
        <span className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
          {icon && <span className="text-slate-400 dark:text-slate-500 shrink-0 text-[15px]">{icon}</span>}
          <span
            className={`truncate min-w-0 text-[13px] ${selected ? "text-slate-900 dark:text-slate-100" : "text-slate-400 dark:text-slate-500"} ${
              variant === "filter" && selected ? "font-medium text-blue-700 dark:text-blue-400" : ""
            } ${disabled ? "text-slate-400 dark:text-slate-500" : ""}`}
          >
            {selected
              ? options.find((o) => o.value === selected)?.label
              : placeholder}
          </span>
        </span>
        <HiChevronDown
          className={`shrink-0 text-slate-400 dark:text-slate-500 text-base transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </div>

      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: "fixed",
              top: pos.top,
              bottom: pos.bottom,
              left: pos.left,
              width: pos.width,
              maxHeight: pos.maxHeight,
              zIndex: 9999,
            }}
            className="bg-white dark:bg-night-900 border border-slate-200 dark:border-night-700 rounded-xl shadow-[0_12px_28px_-8px_rgba(15,23,42,0.18)] dark:shadow-none overflow-y-auto p-1.5 flex flex-col gap-0.5"
          >
            {options.map((option) => (
              <div
                key={option.value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(option)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-[13px] transition-colors ${
                  option.value === selected
                    ? `${selectedItemColors[color]} font-semibold`
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-night-800"
                }`}
              >
                {option.icon && <span>{option.icon}</span>}
                <span>{option.label}</span>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

export default Select;
