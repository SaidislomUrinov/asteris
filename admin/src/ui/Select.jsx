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
  color = "slate",
  variant = "slate",
  icon = null,
}) {
  const colors = {
    emerald: "hover:ring-emerald-500 ring-emerald-500",
    blue: "hover:ring-blue-500 ring-blue-500",
    black: "hover:ring-black ring-black",
    red: "hover:ring-red-500 ring-red-500",
    orange: "hover:ring-orange-500 ring-orange-500",
    yellow: "hover:ring-yellow-500 ring-yellow-500",
    slate: "hover:ring-slate-500 ring-slate-500",
  };

  const openBorderColors = {
    emerald: "border-emerald-500",
    blue: "border-blue-500",
    black: "border-black",
    red: "border-red-500",
    orange: "border-orange-500",
    yellow: "border-yellow-500",
    slate: "border-slate-500",
  };

  const selectedItemColors = {
    emerald: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    black: "bg-zinc-100 text-black",
    red: "bg-red-50 text-red-700",
    orange: "bg-orange-50 text-orange-700",
    yellow: "bg-yellow-50 text-yellow-700",
    slate: "bg-slate-100 text-slate-700",
  };

  const variants = {
    slate: "bg-slate-100 border-slate-200",
    white: "bg-white border-slate-200",
  };
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

  useEffect(() => {
    setSelected(value);
  }, [value]);

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
    <div className={`flex flex-col gap-1 w-full ${className}`}>
      {label && (
        <span className="pl-2 text-sm text-slate-800">
          {label} {required && <span className="text-red-500">*</span>}
        </span>
      )}

      <div
        ref={triggerRef}
        onClick={handleOpen}
        className={`relative w-full h-10 rounded-xl flex items-center duration-300 justify-between border select-none ${icon ? "pl-2 pr-3" : "px-3"} ${variants[variant]} ${
          disabled
            ? "opacity-50 cursor-not-allowed"
            : `cursor-pointer hover:ring-2 ${colors[color]}`
        } ${open ? `ring-2 ${colors[color]} ${openBorderColors[color]}` : ""}`}
      >
        <span className="flex items-center gap-2 overflow-hidden">
          {icon && <span className="text-slate-500 shrink-0">{icon}</span>}
          <span
            className={`truncate ${selected ? "text-slate-800" : "text-slate-400"}`}
          >
            {selected
              ? options.find((o) => o.value === selected)?.label
              : placeholder}
          </span>
        </span>
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
            className="bg-white border border-zinc-200 rounded-xl shadow-xl overflow-y-auto py-1"
          >
            {options.map((option) => (
              <div
                key={option.value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(option)}
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-[13px] font-medium transition-colors ${
                  option.value === selected
                    ? `${selectedItemColors[color]} font-semibold`
                    : "text-zinc-700 hover:bg-zinc-50"
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
