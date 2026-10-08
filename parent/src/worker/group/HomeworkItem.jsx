import { useTranslation } from "react-i18next";
import { fmtDate, weekdayKey } from "../../utils/format";
import { cn } from "../../utils/cn";

// Vazifalar tarixidagi bitta yozuv: sana, matn, kim yozgan. Bosilsa —
// tahrirlash uchun shu sana tanlanadi.
export const HomeworkItem = ({ item, active, onClick }) => {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left py-2.5 flex flex-col gap-1 active:opacity-70",
        active && "rounded-xl bg-accent/10 -mx-2 px-2",
      )}
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className={cn("text-[13px] font-extrabold tabular", active && "text-accent")}>
          {t(`days.${weekdayKey(item.date)}`)}, {fmtDate(item.date)}
        </span>
        {item.updatedBy?.name && <span className="text-[11px] text-hint truncate min-w-0">{item.updatedBy.name}</span>}
      </span>
      <span className="text-[13.5px] leading-snug text-ink/90 whitespace-pre-line break-words line-clamp-4">
        {item.text}
      </span>
    </button>
  );
};
