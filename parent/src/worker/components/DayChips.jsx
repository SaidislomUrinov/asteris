import { useTranslation } from "react-i18next";

const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

// Guruh dars kunlari: "Du Ch Ju" kichik chiplar.
export const DayChips = ({ days }) => {
  const { t } = useTranslation();
  if (!days?.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {DAY_ORDER.filter((d) => days.includes(d)).map((d) => (
        <span key={d} className="min-w-7 px-1.5 h-6 rounded-md bg-ink/6 text-[11px] font-bold text-ink/70 grid place-items-center">
          {t(`days.${d}`)}
        </span>
      ))}
    </div>
  );
};
