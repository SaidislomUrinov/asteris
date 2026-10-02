import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Link, useLocation } from "react-router-dom";
import { HiChartPie } from "react-icons/hi";
import {
  HiBanknotes,
  HiBuildingOffice2,
  HiHome,
  HiPlayCircle,
  HiUser,
  HiUserGroup,
  HiUsers,
  HiWallet,
} from "react-icons/hi2";
import useCan from "../hooks/useCan";
import { buildTabAvailability, resolveTabKeys } from "../utils/tabBar";
import { isSectionActive } from "../utils/navSections";

// Har bir tab uchun metama'lumot — tarkib/tartib `utils/tabBar.js` da.
const TAB_META = {
  dashboard: { to: "/dashboard", icon: HiChartPie, labelKey: "nav.dashboard" },
  centers: { to: "/centers", icon: HiBuildingOffice2, labelKey: "nav.centers" },
  staff: { to: "/staff", icon: HiUsers, labelKey: "nav.staff" },
  rooms: { to: "/rooms", icon: HiHome, labelKey: "nav.rooms" },
  lesson: { to: "/lesson", icon: HiPlayCircle, labelKey: "nav.lesson" },
  groups: { to: "/groups", icon: HiUserGroup, labelKey: "nav.groups" },
  students: { to: "/students", icon: HiUsers, labelKey: "nav.students" },
  salary: { to: "/salary", icon: HiBanknotes, labelKey: "nav.salary" },
  finance: { to: "/finance", icon: HiWallet, labelKey: "nav.finance" },
  profile: { to: "/profile", icon: HiUser, labelKey: "nav.profile" },
};

function MobileTabBar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const can = useCan();
  const { authType, role } = useSelector((e) => e.user);

  const availability = buildTabAvailability(authType, can);
  const tabs = resolveTabKeys(authType, role, availability).map((key) => TAB_META[key]);

  if (tabs.length < 2) return null;

  // Fon sidebar bilan bir xil brend ko'ki — mobilda ikkalasi bir vaqtda
  // ko'rinadi (menyu ochilganda), turli xil to'q ranglar bo'lsa ular
  // bir-biriga yamoqdek ko'rinardi.
  return (
    <div className="fixed bottom-0 left-0 w-full h-16 bg-[#06122c] border-t border-white/7 flex items-center justify-around z-2 lg:hidden pb-[env(safe-area-inset-bottom)]">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = isSectionActive(pathname, tab.to);
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
