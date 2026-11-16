import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { HiCheck, HiChevronDown, HiMagnifyingGlass, HiXMark } from "react-icons/hi2";
import { DAYS } from "../../utils/schedule";

// Guruhlarni ko'p tanlash: asosiy qator — o'qituvchi · kunlar · vaqt, guruh nomi ikkinchi darajali.
// Bo'sh tanlov = "Barcha guruhlar" (SmsSendPanel'dagi groupIds bo'sh bo'lsa hammasi).
function GroupMultiSelect({ groups, value, onChange }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, maxHeight: 320, bottom: undefined });
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  const describe = (g) => {
    const days = DAYS.filter((d) => g.days?.includes(d))
      .map((d) => t(`group.dayShort.${d}`))
      .join(" ");
    const time = g.startTime && g.endTime ? `${g.startTime}–${g.endTime}` : "";
    return {
      teacher: g.teacherName || t("group.noTeacher"),
      schedule: [days, time].filter(Boolean).join(" · "),
      name: g.name || g.label || "",
    };
  };

  const items = useMemo(
    () =>
      groups
        .map((g) => ({ id: g._id, ...describe(g), start: g.startTime || "", hasTeacher: !!g.teacherName }))
        .sort((a, b) => Number(b.hasTeacher) - Number(a.hasTeacher) || a.teacher.localeCompare(b.teacher) || a.start.localeCompare(b.start)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groups, t],
  );

  const q = query.trim().toLowerCase();
  const shown = q ? items.filter((x) => `${x.teacher} ${x.schedule} ${x.name}`.toLowerCase().includes(q)) : items;
  const selected = items.filter((x) => value.includes(x.id));

  const calcPos = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const GAP = 4;
    const below = window.innerHeight - rect.bottom - GAP;
    const above = rect.top - GAP;
    const maxH = Math.min(window.innerHeight * 0.5, 360);
    const up = below < 220 && above > below;
    setPos({
      width: rect.width,
      left: rect.left,
      top: up ? undefined : rect.bottom + GAP,
      bottom: up ? window.innerHeight - rect.top + GAP : undefined,
      maxHeight: Math.min(maxH, up ? above : below),
    });
  };

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const toggleOpen = () => {
    if (open) return close();
    calcPos();
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (triggerRef.current?.contains(e.target) || dropdownRef.current?.contains(e.target)) return;
      close();
    };
    const onScroll = (e) => {
      if (dropdownRef.current?.contains(e.target)) return;
      calcPos();
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", calcPos);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", calcPos);
    };
  }, [open]);

  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <div className="flex flex-col gap-2 w-full">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        className={`flex items-center justify-between w-full h-11 px-3.5 rounded-xl border bg-white dark:bg-night-900 cursor-pointer text-left duration-200 ${
          open ? "ring-3 ring-blue-500/15 border-blue-500" : "border-slate-200 dark:border-night-700 hover:border-slate-300 dark:hover:border-night-600"
        }`}
      >
        <span className={`truncate text-[13px] ${value.length ? "text-slate-900 dark:text-slate-100" : "text-slate-500 dark:text-slate-400"}`}>
          {value.length ? t("sms.groupsSelected", { count: value.length }) : t("sms.allGroups")}
        </span>
        <HiChevronDown className={`shrink-0 ml-2 text-slate-400 dark:text-slate-500 duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((x) => (
            <span
              key={x.id}
              className="inline-flex items-center gap-1 max-w-full pl-2.5 pr-1 py-1 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300"
            >
              <span className="truncate">{x.teacher}{x.schedule && ` · ${x.schedule}`}</span>
              <button
                type="button"
                onClick={() => toggle(x.id)}
                className="shrink-0 p-0.5 rounded-md hover:bg-blue-100 dark:hover:bg-blue-500/25 cursor-pointer"
              >
                <HiXMark />
              </button>
            </span>
          ))}
        </div>
      )}

      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{ position: "fixed", top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width, maxHeight: pos.maxHeight, zIndex: 9999 }}
            className="flex flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 shadow-xl"
          >
            <div className="flex items-center gap-2 px-3 h-10 shrink-0 border-b border-slate-100 dark:border-night-700">
              <HiMagnifyingGlass className="shrink-0 text-slate-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("common.search")}
                className="flex-1 min-w-0 bg-transparent outline-none text-[13px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
              />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <button
                type="button"
                onClick={() => onChange([])}
                className="flex items-center justify-between w-full px-3 py-2.5 text-left text-[13px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-night-800 cursor-pointer border-b border-slate-100 dark:border-night-700"
              >
                {t("sms.allGroups")}
                {value.length === 0 && <HiCheck className="text-blue-500" />}
              </button>
              {shown.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-slate-400 dark:text-slate-500">{t("sms.noGroups")}</p>
              ) : (
                shown.map((x) => {
                  const on = value.includes(x.id);
                  return (
                    <button
                      type="button"
                      key={x.id}
                      onClick={() => toggle(x.id)}
                      className={`flex items-center gap-3 w-full px-3 py-2 text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-night-800 ${on ? "bg-blue-50/60 dark:bg-blue-500/10" : ""}`}
                    >
                      <span
                        className={`flex items-center justify-center w-5 h-5 rounded-md border shrink-0 ${
                          on ? "bg-blue-500 border-blue-500 text-white" : "border-slate-300 dark:border-night-600"
                        }`}
                      >
                        {on && <HiCheck className="text-xs" />}
                      </span>
                      <span className="flex flex-col min-w-0">
                        <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 truncate">
                          {x.teacher}
                          {x.schedule && <span className="font-medium text-slate-500 dark:text-slate-400"> · {x.schedule}</span>}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-500 truncate">{x.name}</span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export default GroupMultiSelect;
