import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HiEllipsisVertical } from "react-icons/hi2";
import IconButton from "./IconButton";

const MENU_WIDTH = 224; // w-56

function DropdownMenu({ items = [], onOpenChange, trigger, align = "end" }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        menuRef.current?.contains(e.target) ||
        dropdownRef.current?.contains(e.target)
      )
        return;
      setOpen(false);
      onOpenChange?.(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleScroll = () => {
      setOpen(false);
      onOpenChange?.(false);
    };
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleOpen = () => {
    onOpenChange?.(!open);
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const menuHeight =
        items.length * 40 + items.filter((i) => i.hint).length * 28 + 20;
      const spaceBelow = window.innerHeight - rect.bottom;
      const top =
        spaceBelow < menuHeight && rect.top > menuHeight
          ? rect.top - menuHeight
          : rect.bottom + 4;
      // Menu doim trigger'ning CHAP tomonida ochiladi (o'ng qirrasi trigger'ning
      // o'ng qirrasiga tekislanadi) — o'ng chetdagi "Amallar" ustunida ekrandan
      // tashqariga chiqib ketmasligi uchun.
      // `align="start"` — chap qirralar tekislanadi (sahifa chap chetidagi
      // trigger uchun, masalan o'quvchi avatari — aks holda menyu sidebar ustiga chiqadi).
      const left =
        align === "start"
          ? Math.max(8, Math.min(rect.left, window.innerWidth - MENU_WIDTH - 8))
          : Math.max(8, rect.right - MENU_WIDTH);
      setPos({ top, left });
    }
    setOpen((p) => !p);
  };

  return (
    <div ref={menuRef} className="">
      <div ref={triggerRef} onClick={handleOpen}>
        {trigger || (
          <IconButton
            color={open ? "blue" : "black"}
            variant="ghost"
            className={`transition-all duration-200 ${open ? "rotate-90" : ""}`}
          >
            <HiEllipsisVertical className="text-xl" />
          </IconButton>
        )}
      </div>

      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{ top: pos.top, left: pos.left, zIndex: 9999 }}
            className="fixed w-56 flex flex-col gap-0.5 bg-white dark:bg-night-900 rounded-xl border border-slate-200 dark:border-night-700 shadow-[0_12px_28px_-8px_rgba(15,23,42,0.18)] dark:shadow-none p-1.5"
          >
            {items.map((item, index) => {
              // `disabled` band xira va bosilmaydi; `hint` — nega yopiqligi
              // (label ostida kichik matn + `title` tooltip). `title` alohida
              // berilsa o'sha ishlatiladi. Eski {label, icon, onClick} shakli
              // o'zgarishsiz ishlaydi.
              const tip = item.title || item.hint || undefined;
              return (
                <div key={index} title={tip}>
                  <button
                    type="button"
                    disabled={item.disabled}
                    aria-disabled={item.disabled || undefined}
                    onClick={() => {
                      if (item.disabled) return;
                      item.onClick?.();
                      setOpen(false);
                      onOpenChange?.(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-[13px] font-medium text-slate-700 dark:text-slate-300 text-left transition-colors enabled:cursor-pointer enabled:hover:bg-slate-50 dark:enabled:hover:bg-night-800 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${item.iconClass}`}
                    >
                      <item.icon className="text-base" />
                    </span>
                    <span className="flex flex-col min-w-0">
                      <span className="truncate leading-snug">{item.label}</span>
                      {item.hint && (
                        <span className="text-[11px] font-normal leading-snug text-slate-500 dark:text-slate-400 whitespace-normal">
                          {item.hint}
                        </span>
                      )}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}

export default DropdownMenu;
