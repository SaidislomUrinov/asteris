import { useTranslation } from "react-i18next";

// Hodim kirish raqami (`+998901234567`) — login o'rniga hamma joyda shu
// (docs/API_CONTRACT_staff_phone.md §5). Eski hodimda raqam hali yo'q
// bo'lsa — kichik "Raqam kiritilmagan" belgisi (Owner kimga kiritish
// kerakligini ko'radi). Matn rangi/o'lchami ota elementdan meros.
function StaffPhone({ phone, className = "" }) {
  const { t } = useTranslation();
  if (phone) return <span className={`tabular-nums ${className}`}>{phone}</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
      {t("staff.noPhone")}
    </span>
  );
}

export default StaffPhone;
