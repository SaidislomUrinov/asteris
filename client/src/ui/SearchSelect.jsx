import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { HiChevronDown, HiXMark } from "react-icons/hi2";

/**
 * Async qidiruv bilan Select
 *
 * @param {string} value - tanlangan qiymat (_id)
 * @param {function} onChange - (value, item) => void
 * @param {function} onSearch - async (q) => [{ value, label, sub? }]
 * @param {string} displayValue - ko'rsatiladigan matn (tashqaridan boshqariladi)
 * @param {string} label
 * @param {string} placeholder
 * @param {string} searchPlaceholder
 * @param {boolean} required
 * @param {boolean} disabled
 * @param {string} color
 * @param {string} variant
 * @param {string} className
 */
function SearchSelect({
  value = "",
  onChange = () => {},
  onSearch,
  displayValue = "",
  label = "",
  placeholder,
  searchPlaceholder,
  required = false,
  disabled = false,
  color = "blue",
  variant = "slate",
  className = "",
}) {
  const { t } = useTranslation();
  const _placeholder = placeholder ?? t("common.select");
  const _searchPlaceholder = searchPlaceholder ?? t("common.search");

  const colors = {
    emerald: "ring-emerald-500/15 border-emerald-500",
    blue: "ring-blue-500/15 border-blue-500",
    black: "ring-slate-900/10 border-slate-900",
    red: "ring-red-500/15 border-red-500",
    orange: "ring-orange-500/15 border-orange-500",
    yellow: "ring-yellow-500/20 border-yellow-500",
    slate: "ring-slate-500/15 border-slate-500",
  };
  const variants = {
    slate: "bg-white border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
    white: "bg-white border-slate-200",
  };

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, maxHeight: 240, bottom: undefined });

  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const searchTimer = useRef(null);

  const calcPos = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const GAP = 4;
    const spaceBelow = window.innerHeight - rect.bottom - GAP;
    const spaceAbove = rect.top - GAP;
    const maxDropH = Math.min(window.innerHeight * 0.4, 280);
    const openUpward = spaceBelow < 180 && spaceAbove > spaceBelow;
    setPos({
      width: rect.width,
      left: rect.left,
      top: openUpward ? undefined : rect.bottom + GAP,
      bottom: openUpward ? window.innerHeight - rect.top + GAP : undefined,
      maxHeight: openUpward ? Math.min(maxDropH, spaceAbove) : Math.min(maxDropH, spaceBelow),
    });
  };

  const handleOpen = () => {
    if (disabled) return;
    calcPos();
    setOpen(true);
    setQuery("");
    setOptions([]);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleClose = () => { setOpen(false); setQuery(""); setOptions([]); };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange("", null);
  };

  // Search debounce
  useEffect(() => {
    if (!open) return;
    clearTimeout(searchTimer.current);
    // Debounce'ning o'zi taymer — setState'lar ham taymer ichida (effect
    // tanasida sinxron setState yo'q).
    const q = query.trim();
    searchTimer.current = setTimeout(
      async () => {
        if (!q) {
          setOptions([]);
          return;
        }
        setLoading(true);
        try {
          const res = await onSearch(q);
          setOptions(res || []);
        } catch {
          setOptions([]);
        } finally {
          setLoading(false);
        }
      },
      q ? 300 : 0,
    );
    return () => clearTimeout(searchTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open]);

  // Outside click + scroll reposition
  useEffect(() => {
    if (!open) return;
    const handleOutside = (e) => {
      if (triggerRef.current?.contains(e.target) || dropdownRef.current?.contains(e.target)) return;
      handleClose();
    };
    const handleScroll = (e) => {
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

  const handleSelect = (opt) => {
    onChange(opt.value, opt);
    handleClose();
  };

  const shown = displayValue || (value ? value : "");

  return (
    <div className={`flex flex-col gap-1 w-full ${className}`}>
      {label && (
        <span className="text-xs font-medium text-slate-600">
          {label}{required && <span className="text-rose-500">*</span>}
        </span>
      )}

      <div
        ref={triggerRef}
        onClick={handleOpen}
        className={`relative w-full h-11 rounded-xl flex items-center justify-between border px-3.5 select-none duration-200
          ${variants[variant]}
          ${disabled ? "bg-slate-50 border-slate-200 shadow-none cursor-not-allowed" : "cursor-pointer hover:border-slate-300"}
          ${open ? `ring-3 ${colors[color]}` : ""}`}
      >
        <span className={`truncate text-[13px] ${value ? "text-slate-900" : "text-slate-400"}`}>
          {value ? shown : _placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {value && !disabled && (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleClear}
              className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <HiXMark size={14} />
            </button>
          )}
          <HiChevronDown
            size={16}
            className={`text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </div>
      </div>

      {open && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: "fixed", top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width, maxHeight: pos.maxHeight, zIndex: 9999 }}
          className="bg-white border border-zinc-200 rounded-xl shadow-xl flex flex-col overflow-hidden"
        >
          {/* Search input */}
          <div className="p-2 border-b border-slate-100 shrink-0">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={_searchPlaceholder}
              className="w-full h-8 px-3 rounded-lg bg-slate-100 text-[13px] text-slate-800 placeholder:text-slate-400 outline-none focus:bg-slate-50 transition-colors"
            />
          </div>

          {/* Results */}
          <div className="overflow-y-auto flex-1 py-1">
            {loading ? (
              <p className="text-center text-zinc-400 text-[12px] py-4">{t("common.searching")}</p>
            ) : options.length === 0 ? (
              <p className="text-center text-zinc-400 text-[12px] py-4">
                {query.trim() ? t("common.noResults") : t("common.typeToSearch")}
              </p>
            ) : options.map((opt) => (
              <div
                key={opt.value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(opt)}
                className={`flex flex-col px-3 py-2 cursor-pointer transition-colors text-[13px]
                  ${opt.value === value ? "bg-blue-50 text-blue-700 font-semibold" : "text-zinc-700 hover:bg-zinc-50"}`}
              >
                <span className="font-medium">{opt.label}</span>
                {opt.sub && <span className="text-[11px] text-zinc-400 mt-0.5">{opt.sub}</span>}
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default SearchSelect;
