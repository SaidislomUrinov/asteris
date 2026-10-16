import { useState } from "react";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { HiBuildingOffice2, HiCheck, HiChevronDown, HiLockClosed, HiPlus } from "react-icons/hi2";
import DropMenu from "../ui/DropMenu";
import switchCenter from "../utils/switchCenter";
import { openCenterCreate, openCenterUnblock } from "../utils/centerActions";

/**
 * Top paneldagi faol filial (docs/API_CONTRACT_multi_center.md §5). Owner ham,
 * ko'p filialli hodim ham bir vaqtda BITTA filialda ishlaydi — "barcha
 * filiallar" rejimi yo'q. Owner menyusida oxirida "Filial qo'shish"
 * (docs/API_CONTRACT_center_switcher.md) — alohida Filiallar sahifasi yo'q.
 * Hodimning bitta filiali bo'lsa faqat nomi ko'rinadi.
 */
export default function CenterSwitcher() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { centers = [], activeCenter, authType } = useSelector((e) => e.user);
  const list = Array.isArray(centers) ? centers : [];
  const isOwner = authType === "owner";
  if (!list.length && !isOwner) return null;

  const active = list.find((c) => c._id === activeCenter) || list[0];
  const interactive = isOwner || list.length > 1;

  // Mobilda faqat ikonka (sarlavha uchun joy qoladi), sm+ da nom + strelka.
  const label = (
    <span
      className={`flex items-center justify-center gap-1.5 min-w-0 h-9 w-9 sm:w-auto sm:px-3 rounded-xl text-white/90 ${
        interactive
          ? `cursor-pointer transition-colors ${open ? "bg-white/20 text-white" : "bg-white/10 hover:bg-white/20"}`
          : ""
      }`}
      title={active?.name || t("center.create")}
    >
      {active ? (
        <HiBuildingOffice2 className="text-lg shrink-0 text-white/70" />
      ) : (
        <HiPlus className="text-lg shrink-0 text-white/70" />
      )}
      <span className="hidden sm:block truncate max-w-[12rem] text-sm font-semibold">
        {active?.name || t("center.create")}
      </span>
      {interactive && active && (
        <HiChevronDown
          className={`hidden sm:block text-sm shrink-0 text-white/60 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      )}
    </span>
  );

  if (!interactive) return label;

  // Filial hali yo'q — trigger o'zi "Filial qo'shish" tugmasi.
  if (!active) {
    return (
      <button type="button" onClick={openCenterCreate}>
        {label}
      </button>
    );
  }

  const items = list.map((c) => {
    const isActive = c._id === active._id;
    const blocked = c.status === "blocked";
    return {
      label: c.name,
      icon: isActive ? HiCheck : blocked ? HiLockClosed : HiBuildingOffice2,
      iconClass: isActive
        ? "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400"
        : blocked
          ? "bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400"
          : "bg-slate-100 dark:bg-night-800 text-slate-500 dark:text-slate-400",
      hint: blocked ? t("centerSwitch.blocked") : undefined,
      // Joriy filial — tanlangan holat, bosilsa hech narsa qilmaydi. Bloklangan
      // filialga o'tib bo'lmaydi — Owner'ga "Qayta yoqish" tasdig'i ochiladi.
      onClick: () => {
        if (isActive) return;
        if (blocked) {
          if (isOwner) openCenterUnblock(c);
          return;
        }
        switchCenter(c._id);
      },
    };
  });

  if (isOwner) {
    items.push({
      divider: true,
      label: t("center.create"),
      icon: HiPlus,
      iconClass: "bg-blue-500 text-white",
      onClick: openCenterCreate,
    });
  }

  return <DropMenu trigger={label} items={items} onOpenChange={setOpen} />;
}
