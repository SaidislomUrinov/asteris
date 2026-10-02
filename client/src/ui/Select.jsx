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
    emerald: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    black: "bg-slate-100 text-slate-900",
    red: "bg-red-50 text-red-700",
    orange: "bg-orange-50 text-orange-700",
    yellow: "bg-yellow-50 text-yellow-700",
    slate: "bg-slate-100 text-slate-700",
  };

  // Qiymat tanlanganda maydon avval butunlay rangga bo'yalardi; yangi dizaynda
  // u oq qoladi (qatordagi barcha maydonlar bir xil ko'rinadi) va tanlangani
  // faqat matnning to'qligi bilan ajralib turadi — shu sabab alohida
  // "active trigger" ranglari kerak emas.
  const variants = {
    slate: "bg-white border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
    white: "bg-white border-slate-200",
    // Faqat FilterBar ichida ishlatiladi: bo'sh bo'lganda oddiy oq, qiymat
    // tanlanganda ochiq ko'k fon bilan ajralib turadi — foydalanuvchi qaysi
    // filtrlar faol ekanini qatorga qarab darhol ko'radi.
    filter: "bg-white border-slate-200",
  };

  const filterSelectedClasses =
    "!bg-blue-50 !border-blue-200 hover:!border-blue-300";
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
        <span className="text-xs font-medium text-slate-600">
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
            ? "bg-slate-50 border-slate-200 shadow-none cursor-not-allowed"
            : `cursor-pointer hover:border-slate-300`
        } ${variant === "filter" && selected ? filterSelectedClasses : ""} ${open ? `ring-3 ${colors[color]} ${openBorderColors[color]}` : ""}`}
      >
        <span className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
          {icon && <span className="text-slate-400 shrink-0 text-[15px]">{icon}</span>}
          <span
            className={`truncate min-w-0 text-[13px] ${selected ? "text-slate-900" : "text-slate-400"} ${
              variant === "filter" && selected ? "font-medium text-blue-700" : ""
            } ${disabled ? "text-slate-400" : ""}`}
          >
            {selected
              ? options.find((o) => o.value === selected)?.label
              : placeholder}
          </span>
        </span>
        <HiChevronDown
          className={`shrink-0 text-slate-400 text-base transition-transform duration-200 ${open ? "rotate-180" : ""}`}
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
            className="bg-white border border-slate-200 rounded-xl shadow-[0_12px_28px_-8px_rgba(15,23,42,0.18)] overflow-y-auto p-1.5 flex flex-col gap-0.5"
          >
            {options.map((option) => (
              <div
                key={option.value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(option)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-[13px] transition-colors ${
                  option.value === selected
                    ? `${selectedItemColors[color]} font-semibold`
                    : "text-slate-700 hover:bg-slate-50"
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
