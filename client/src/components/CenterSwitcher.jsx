import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { HiBuildingOffice2, HiCheck, HiChevronDown } from "react-icons/hi2";
import DropMenu from "../ui/DropMenu";
import switchCenter from "../utils/switchCenter";

/**
 * Top paneldagi faol filial (docs/API_CONTRACT_multi_center.md §5). Owner ham,
 * ko'p filialli hodim ham bir vaqtda BITTA filialda ishlaydi — "barcha
 * filiallar" rejimi yo'q. Bitta filial bo'lsa faqat nomi ko'rinadi.
 */
export default function CenterSwitcher() {
  const { t } = useTranslation();
  const { centers = [], activeCenter } = useSelector((e) => e.user);
  if (!Array.isArray(centers) || !centers.length) return null;

  const active = centers.find((c) => c._id === activeCenter) || centers[0];
  const many = centers.length > 1;

  // Mobilda faqat ikonka (sarlavha uchun joy qoladi), sm+ da nom + strelka.
  const label = (
    <span
      className={`flex items-center justify-center gap-1.5 min-w-0 h-9 w-9 sm:w-auto sm:px-3 rounded-xl text-white/90 ${
        many ? "bg-white/8 hover:bg-white/14 cursor-pointer transition-colors" : ""
      }`}
      title={active.name}
    >
      <HiBuildingOffice2 className="text-lg shrink-0 text-white/70" />
      <span className="hidden sm:block truncate max-w-[12rem] text-sm font-semibold">{active.name}</span>
      {many && <HiChevronDown className="hidden sm:block text-sm shrink-0 text-white/60" />}
    </span>
  );

  if (!many) return label;

  const items = centers.map((c) => {
    const isActive = c._id === active._id;
    const blocked = c.status === "blocked";
    return {
      label: c.name,
      icon: isActive ? HiCheck : HiBuildingOffice2,
      iconClass: isActive
        ? "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400"
        : "bg-slate-100 dark:bg-night-800 text-slate-500 dark:text-slate-400",
      hint: isActive ? t("centerSwitch.current") : blocked ? t("centerSwitch.blocked") : undefined,
      // Joriy filial — tanlangan holat (xira "o'chiq" emas), bosilsa hech narsa qilmaydi.
      onClick: () => !isActive && switchCenter(c._id),
    };
  });

  return <DropMenu trigger={label} items={items} />;
}
