import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Link, useLocation } from "react-router-dom";
import useNavItems, { pickTabBarItems } from "../hooks/useNavItems";
import { isSectionActive } from "../utils/navSections";

// Bandlar va tarkib — hooks/useNavItems.js (Navbar bilan yagona manba).
function MobileTabBar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { authType, role } = useSelector((e) => e.user);
  const tabs = pickTabBarItems(useNavItems(), authType, role);

  if (tabs.length < 2) return null;

  // Fon sidebar bilan bir xil brend ko'ki — mobilda ikkalasi bir vaqtda
  // ko'rinadi (menyu ochilganda), turli xil to'q ranglar bo'lsa ular
  // bir-biriga yamoqdek ko'rinardi.
  return (
    <div className="fixed bottom-0 left-0 w-full h-16 bg-[#06122c] border-t border-white/7 flex items-center justify-around z-2 lg:hidden pb-[env(safe-area-inset-bottom)]">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = (tab.match || [tab.to]).some((path) => isSectionActive(pathname, path));
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full duration-150 ${
              isActive ? "text-blue-400" : "text-white/60"
            }`}
          >
            <Icon className="text-xl" />
            <span className="text-[10px] font-medium truncate max-w-full px-1">
              {t(tab.labelKey)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export default MobileTabBar;
