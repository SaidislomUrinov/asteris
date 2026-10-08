import { createElement } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { cn } from "../utils/cn";
import { haptic } from "../lib/telegram";
import { useWorker } from "./useWorker";
import { FAB_DEFS, MENU_ORDER, ROLE_LAYOUT, TAB_DEFS, defAllowed } from "./constants";

// Rol jadvali (details §1) → haqiqiy slotlar. Ruxsati/tarifi yo'q tab yoki
// FAB — bo'sh joy (band umuman ko'rinmaydi).
const buildSlots = (role, can, hasFeature) =>
  (ROLE_LAYOUT[role] || ROLE_LAYOUT.teacher).map((key) => {
    if (FAB_DEFS[key]) return can(FAB_DEFS[key].perm) ? { fab: key } : { empty: true };
    return defAllowed(TAB_DEFS[key], role, can, hasFeature) ? { tab: key } : { empty: true };
  });

// Faol tab: o'z yo'li va uning ichki sahifalari (/groups → /groups/:id).
// "Menyu" — menyudan ochiladigan sahifalarda ham faol ko'rinadi.
const isActiveTab = (key, pathname, slotKeys) => {
  const to = TAB_DEFS[key].to;
  if (to === "/") return pathname === "/";
  if (pathname === to || pathname.startsWith(`${to}/`)) return true;
  if (key !== "menu") return false;
  return MENU_ORDER.some((k) => !slotKeys.includes(k) && pathname === TAB_DEFS[k].to);
};

export const WorkerTabBar = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { role, roleColor, can, hasFeature, readOnly, openSheet, chatUnread } = useWorker();
  const slots = buildSlots(role, can, hasFeature);
  const slotKeys = slots.map((s) => s.tab).filter(Boolean);

  const onFab = (key) => {
    const def = FAB_DEFS[key];
    if (def.sheet && readOnly) {
      haptic("warning");
      toast.info(t("worker.readOnly.fab"), { id: "ro-fab" });
      return;
    }
    haptic("medium");
    if (def.sheet) openSheet(def.sheet);
    else navigate(def.to);
  };

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-20 bg-card border-t border-line"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-5 max-w-lg mx-auto">
        {slots.map((s, i) => {
          if (s.empty) return <span key={`e${i}`} aria-hidden="true" />;
          if (s.fab) {
            const def = FAB_DEFS[s.fab];
            const disabled = !!def.sheet && readOnly;
            return (
              <button
                key={s.fab}
                type="button"
                onClick={() => onFab(s.fab)}
                aria-disabled={disabled}
                className="flex flex-col items-center gap-0.5 -mt-[18px] pb-1.5 text-[10.5px] font-bold text-ink min-w-0"
              >
                <span
                  className={cn(
                    "w-[52px] h-[52px] rounded-full grid place-items-center text-white border-4 border-card transition-opacity active:opacity-80",
                    disabled && "opacity-45",
                  )}
                  style={{ background: roleColor, boxShadow: disabled ? "none" : `0 8px 18px -8px ${roleColor}` }}
                >
                  {createElement(def.icon, { className: "w-[22px] h-[22px]" })}
                </span>
                <span className={cn("truncate max-w-full", disabled && "text-hint")}>{t(def.key)}</span>
              </button>
            );
          }
          const def = TAB_DEFS[s.tab];
          const active = isActiveTab(s.tab, pathname, slotKeys);
          return (
            <Link
              key={s.tab}
              to={def.to}
              replace={active}
              onClick={() => haptic("light")}
              aria-current={active ? "page" : undefined}
              className="flex flex-col items-center gap-0.5 pt-1.5 pb-1.5 text-[10.5px] font-bold min-w-0"
              style={{ color: active ? roleColor : "var(--tg-hint)" }}
            >
              <span
                className="relative w-12 h-7 rounded-full grid place-items-center transition-colors"
                style={{ backgroundColor: active ? `color-mix(in srgb, ${roleColor} 14%, transparent)` : "transparent" }}
              >
                {createElement(active ? def.on : def.off, { className: "w-[22px] h-[22px]" })}
                {/* Menyu ichidagi "Yordam"da javob kutmoqda — kichik nuqta. */}
                {s.tab === "menu" && chatUnread > 0 && (
                  <span className="absolute top-0.5 right-2.5 w-2 h-2 rounded-full bg-bad ring-2 ring-card" aria-hidden="true" />
                )}
              </span>
              <span className="truncate max-w-full">{t(def.key)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
