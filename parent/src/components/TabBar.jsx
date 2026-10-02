import { createElement } from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  HiHome, HiOutlineHome, HiCreditCard, HiOutlineCreditCard,
  HiBell, HiOutlineBell, HiCog6Tooth, HiOutlineCog6Tooth,
} from "react-icons/hi2";
import { cn } from "../utils/cn";
import { haptic } from "../lib/telegram";
import { useAuth } from "../contexts/auth";

const TABS = [
  { to: "/", key: "tab.home", on: HiHome, off: HiOutlineHome },
  { to: "/payments", key: "tab.payments", on: HiCreditCard, off: HiOutlineCreditCard, parentOnly: true },
  { to: "/notifications", key: "tab.notifications", on: HiBell, off: HiOutlineBell },
  { to: "/settings", key: "tab.settings", on: HiCog6Tooth, off: HiOutlineCog6Tooth },
];

export const TabBar = () => {
  const { t } = useTranslation();
  const { isStudent } = useAuth();
  const tabs = isStudent ? TABS.filter((x) => !x.parentOnly) : TABS;
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-20 bg-card/85 backdrop-blur-md border-t border-line"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex max-w-lg mx-auto">
        {tabs.map(({ to, key, on, off }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            onClick={() => haptic("light")}
            className={({ isActive }) =>
              cn(
                "flex-1 flex flex-col items-center gap-0.5 pt-1.5 pb-1.5 text-[11px] font-bold min-w-0",
                isActive ? "text-accent" : "text-hint",
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className={cn("w-12 h-7 rounded-full grid place-items-center transition-colors", isActive && "bg-accent/12")}>
                  {createElement(isActive ? on : off, { className: "w-[22px] h-[22px]" })}
                </span>
                <span className="truncate max-w-full">{t(key)}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
