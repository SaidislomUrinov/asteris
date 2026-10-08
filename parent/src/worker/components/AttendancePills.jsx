import { useTranslation } from "react-i18next";
import { Pill } from "../../components/Card";

// Lenta kartasidagi davomat holati: keldi / kelmadi / kechikdi / sababli / belgilanmagan.
const ORDER = [
  ["present", "ok"],
  ["absent", "bad"],
  ["late", "warn"],
  ["excused", "warn"],
  ["unmarked", "mut"],
];

export const AttendancePills = ({ attendance }) => {
  const { t } = useTranslation();
  if (!attendance) return null;
  const items = ORDER.filter(([k]) => (attendance[k] || 0) > 0);
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {items.map(([k, tone]) => (
        <Pill key={k} tone={tone}>{t(`worker.att.count.${k}`, { count: attendance[k] })}</Pill>
      ))}
    </div>
  );
};
