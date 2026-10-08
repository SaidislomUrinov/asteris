import { useTranslation } from "react-i18next";
import { HiCheck } from "react-icons/hi2";
import { Pill } from "../../components/Card";
import { cn } from "../../utils/cn";

// Reja ichidagi bitta dars: raqam, nom, (ixtiyoriy) tavsif/vazifa.
// O'tilgan — yashil belgi va xira nom, joriy — accent ramka, kelgusi — oddiy.
export const PlanLesson = ({ no, lesson, done, current }) => {
  const { t } = useTranslation();
  return (
    <div className={cn(
        "flex items-start gap-2.5 py-2.5",
        current && "rounded-xl bg-accent/10 ring-1 ring-accent/40 -mx-2 px-2",
      )}>
      <span
        className={cn(
          "w-8 h-8 rounded-lg grid place-items-center tabular text-[12px] font-bold shrink-0",
          done ? "bg-ok-bg text-ok" : current ? "bg-accent text-accent-fg" : "bg-ink/6 text-hint",
        )}
      >
        {done ? <HiCheck className="w-4 h-4" /> : no}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className={cn("font-bold text-[14px] leading-snug break-words min-w-0", done && "text-hint")}>{lesson.title}</span>
          {current && <Pill tone="acc" className="shrink-0">{t("worker.group.plan.current")}</Pill>}
        </div>
        {lesson.description && <div className="text-[12.5px] leading-snug text-hint break-words whitespace-pre-line mt-0.5">{lesson.description}</div>}
        {lesson.homework && (
          <div className="text-[12.5px] break-words whitespace-pre-line mt-0.5">
            <span className="font-bold">{t("worker.group.plan.homework")}: </span>
            {lesson.homework}
          </div>
        )}
      </div>
    </div>
  );
};
