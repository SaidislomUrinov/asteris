import { useEffect, useRef, useState } from "react";
import { HiEllipsisVertical } from "react-icons/hi2";
import IconButton from "./IconButton";

const MENU_WIDTH = 224; // w-56

function DropdownMenu({ items = [], onOpenChange }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const menuRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
        onOpenChange?.(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleScroll = () => setOpen(false);
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [open]);

  const handleOpen = () => {
    onOpenChange?.(!open);
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const menuHeight = items.length * 44 + 48;
      const spaceBelow = window.innerHeight - rect.bottom;
      const top =
        spaceBelow < menuHeight && rect.top > menuHeight
          ? rect.top - menuHeight
          : rect.bottom + 4;
      // Menu doim trigger'ning CHAP tomonida ochiladi (o'ng qirrasi trigger'ning
      // o'ng qirrasiga tekislanadi) — o'ng chetdagi "Amallar" ustunida ekrandan
      // tashqariga chiqib ketmasligi uchun.
      const left = Math.max(8, rect.right - MENU_WIDTH);
      setPos({ top, left });
    }
    setOpen((p) => !p);
  };

  return (
    <div ref={menuRef} className="">
      <div ref={triggerRef}>
        <IconButton
          onClick={handleOpen}
          color={open ? "blue" : "black"}
          variant="ghost"
          className={`transition-all duration-200 ${open ? "rotate-90" : ""}`}
        >
          <HiEllipsisVertical className="text-xl" />
        </IconButton>
      </div>

      {open && (
        <div
          style={{ top: pos.top, left: pos.left }}
          className="fixed w-56 bg-white rounded-2xl shadow-2xl border border-zinc-100 py-2 z-2 overflow-hidden"
        >
          {items.map((item, index) => (
            <button
              disabled={item.disabled}
              key={index}
              onClick={() => {
                item.onClick?.();
                setOpen(false);
              }}
              className="w-full disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed flex items-center gap-3 px-3 py-2 text-[13px] font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors text-left"
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${item.iconClass}`}
              >
                <item.icon className="text-lg" />
              </div>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default DropdownMenu;
