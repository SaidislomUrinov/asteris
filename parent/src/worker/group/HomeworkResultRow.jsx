import { createElement } from "react";
import { useTranslation } from "react-i18next";
import { Avatar } from "../../components/Card";
import { initials } from "../../utils/format";
import { photoSrc } from "../../lib/studentPhoto";
import { cn } from "../../utils/cn";
import { RESULT_OPTIONS } from "./homeworkResults";

// Bitta o'quvchi — vazifa natijasi: Bajardi / Chala / Bajarmadi.
// Faol tugmani qayta bosish — natijani olib tashlaydi (`onMark(null)`).
export const HomeworkResultRow = ({ name, photo, tone = 0, status, saving, disabled, onMark }) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 py-2 first:pt-2.5 last:pb-0.5">
      <Avatar text={initials(name)} tone={tone} src={photoSrc(photo)} alt={name} className="w-8 h-8 text-[11px] min-[380px]:mr-1" />
      <div className="flex-1 min-w-0 font-bold text-[13px] min-[380px]:text-[14px] leading-snug line-clamp-2 break-words">
        {name}
      </div>
      <div className={cn("flex gap-1 min-[380px]:gap-1.5 shrink-0", saving && "opacity-60")}>
        {RESULT_OPTIONS.map((o) => {
          const active = status === o.key;
          return (
            <button
              key={o.key}
              type="button"
              disabled={disabled || saving}
              onClick={() => onMark(active ? null : o.key)}
              aria-pressed={active}
              aria-label={t(`worker.homework.result.${o.key}`)}
              title={t(`worker.homework.result.${o.key}`)}
              className={cn(
                "w-9 h-9 min-[380px]:w-10 min-[380px]:h-10 rounded-full grid place-items-center transition-colors active:scale-95 disabled:cursor-not-allowed",
                active ? o.on : "bg-ink/6 text-hint",
              )}
            >
              {createElement(o.icon, { className: "w-5 h-5" })}
            </button>
          );
        })}
      </div>
    </div>
  );
};
