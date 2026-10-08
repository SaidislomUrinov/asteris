import { useTranslation } from "react-i18next";
import { Link, Outlet, useLocation } from "react-router-dom";
import { isSectionActive } from "../utils/navSections";
import { useFinanceTabs, useScheduleTabs, useSettingsTabs } from "../hooks/useSectionTabs";

// Menyuda bitta band bo'lgan bo'lim (Sozlamalar, Jadval, Moliya) sahifalari ustidagi
// umumiy tab qatori. `tabs` — `useSectionTabs` hook'laridan. Detail sahifalar
// (`/centers/:id`, `/rooms/:id`) bu layout'dan tashqarida — o'z sarlavhasi bor.
// Tab ko'rinishi Reports sahifasidagi segment uslubi bilan bir xil.
export default function TabsLayout({ tabs }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  // Eng uzun mos yo'l — `/reports/teacher-performance` ochiq bo'lsa
  // "Hisobotlar" (`/reports`) emas, aynan Samaradorlik yonadi.
  const activeTo = tabs
    .filter((tab) => isSectionActive(pathname, tab.to))
    .reduce((best, tab) => (tab.to.length > best.length ? tab.to : best), "");

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      {tabs.length > 1 && (
        <nav className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 overflow-x-auto shrink-0 self-start max-w-full">
          {tabs.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              className={`shrink-0 px-3 h-8 inline-flex items-center rounded-lg text-[13px] font-semibold transition-colors duration-150 ${
                tab.to === activeTo
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t(tab.labelKey)}
            </Link>
          ))}
        </nav>
      )}
      {/* Sahifalar ildizi `h-full` bilan yozilgan — App.jsx'dagi mobil
          `h-auto` qoidasi shu yerda ham takrorlanadi. */}
      <div className="flex-1 min-h-0 flex flex-col max-lg:[&>*]:!h-auto max-lg:[&>*]:min-h-full">
        <Outlet />
      </div>
    </div>
  );
}

export function SettingsLayout() {
  return <TabsLayout tabs={useSettingsTabs()} />;
}

export function ScheduleLayout() {
  return <TabsLayout tabs={useScheduleTabs()} />;
}

export function FinanceLayout() {
  return <TabsLayout tabs={useFinanceTabs()} />;
}
