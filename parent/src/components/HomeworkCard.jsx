import { useTranslation } from "react-i18next";
import { HiCheckCircle, HiMinusCircle, HiXCircle } from "react-icons/hi2";
import { Card, Pill } from "./Card";
import { fmtDate, fmtTime, weekdayFull } from "../utils/format";
import { homeworkWhen } from "../utils/homework";
import { cn } from "../utils/cn";
import { LinkifiedText } from "./LinkifiedText";

// Bitta uyga vazifa (sana + matn). Bugungi vazifa eng kuchli urg'u (chap
// chiziq + tint), ertangisi yengil urg'u, o'tganlari xiralashtirilgan bo'ladi.
// item: { date: "YYYY-MM-DD", text, updatedAt, status: "done"|"partial"|"missed"|null }
const STATUS_TONE = { done: "ok", partial: "warn", missed: "bad" };
const STATUS_ICON = { done: HiCheckCircle, partial: HiMinusCircle, missed: HiXCircle };
export const HomeworkCard = ({ item }) => {
  const { t } = useTranslation();
  const when = homeworkWhen(item.date);
  const today = when === "today";
  const tomorrow = when === "tomorrow";
  const past = when === "past";
  const StatusIcon = STATUS_ICON[item.status];
  return (
    <Card className={cn(today && "border-l-4 border-l-accent bg-accent/5", past && "opacity-70")}>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 text-[13px] font-bold break-words">
          {weekdayFull(item.date)}, {fmtDate(item.date)}
        </div>
        {item.status ? (
          <Pill tone={STATUS_TONE[item.status]} className="inline-flex items-center gap-1 pl-1.5 py-1">
            <StatusIcon className="w-3.5 h-3.5" />
            {t(`hw.status.${item.status}`)}
          </Pill>
        ) : (
          (today || tomorrow) && <Pill tone={today ? "acc" : "mut"}>{t(`hw.${when}`)}</Pill>
        )}
      </div>
      <div className="text-[15px] leading-relaxed mt-1.5 whitespace-pre-wrap break-words"><LinkifiedText text={item.text} /></div>
      {item.updatedAt ? (
        <div className="text-[10px] text-hint/60 mt-1.5">{t("hw.updatedShort", { t: fmtTime(item.updatedAt) })}</div>
      ) : null}
    </Card>
  );
};
