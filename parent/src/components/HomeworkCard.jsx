import { useTranslation } from "react-i18next";
import { Card, Pill } from "./Card";
import { fmtDate, fmtTime, weekdayFull } from "../utils/format";
import { homeworkWhen } from "../utils/homework";
import { cn } from "../utils/cn";
import { LinkifiedText } from "./LinkifiedText";

// Bitta uyga vazifa (sana + matn). Bugungi vazifa eng kuchli urg'u (chap
// chiziq + tint), ertangisi yengil urg'u, o'tganlari xiralashtirilgan bo'ladi.
// item: { date: "YYYY-MM-DD", text, updatedAt }
export const HomeworkCard = ({ item }) => {
  const { t } = useTranslation();
  const when = homeworkWhen(item.date);
  const today = when === "today";
  const tomorrow = when === "tomorrow";
  const past = when === "past";
  return (
    <Card className={cn(today && "border-l-4 border-l-accent bg-accent/5", past && "opacity-70")}>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 text-[13px] font-bold break-words">
          {weekdayFull(item.date)}, {fmtDate(item.date)}
        </div>
        {(today || tomorrow) && <Pill tone={today ? "acc" : "mut"}>{t(`hw.${when}`)}</Pill>}
      </div>
      <div className="text-[15px] leading-relaxed mt-1.5 whitespace-pre-wrap break-words"><LinkifiedText text={item.text} /></div>
      {item.updatedAt ? (
        <div className="text-[10px] text-hint/60 mt-1.5">{t("hw.updatedShort", { t: fmtTime(item.updatedAt) })}</div>
      ) : null}
    </Card>
  );
};
