import { useTranslation } from "react-i18next";
import { HiChevronRight, HiOutlineAcademicCap, HiOutlineCheckBadge } from "react-icons/hi2";
import { Card, IconBox, Pill } from "./Card";
import { Num } from "./Num";
import { money } from "../utils/format";
import { cn } from "../utils/cn";
import { daysLabel } from "../utils/days";

export const GroupCard = ({ group, onClick, muted }) => {
  const { t } = useTranslation();
  const time = group.startTime && group.endTime ? `${group.startTime}–${group.endTime}` : null;
  const meta = [group.teacherName, daysLabel(group.days, t), time].filter(Boolean).join(" · ");
  const finished = group.status !== "active";
  // Chiqqan/yakunlangan/arxivlangan guruhda ham to'lanmagan qarz ko'rinadi.
  const hasDebt = group.debt > 0;
  const tone = finished ? "mut" : hasDebt ? "bad" : "ok";
  return (
    <Card as="button" onClick={onClick} className={cn("flex items-center gap-3", muted && "opacity-70")}>
      <IconBox Icon={finished ? HiOutlineCheckBadge : HiOutlineAcademicCap} tone={finished ? "mut" : "acc"} />
      <div className="flex-1 min-w-0">
        <div className="font-title font-bold text-[15px] break-words leading-tight">{group.name}</div>
        {meta && <div className="text-xs text-hint mt-1 break-words leading-snug"><Num text={meta} v={time} /></div>}
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Pill tone={tone}>
            {finished ? t(`group.status.${group.status}`) : hasDebt ? <Num text={t("common.debtShort", { v: money(group.debt) })} v={money(group.debt)} /> : t("common.paid")}
          </Pill>
          {group.isIndividual && <Pill tone="acc">{t("group.individual")}</Pill>}
          {finished && hasDebt && <Pill tone="bad"><Num text={t("common.debtShort", { v: money(group.debt) })} v={money(group.debt)} /></Pill>}
        </div>
      </div>
      <HiChevronRight className="w-5 h-5 text-hint/70 shrink-0" />
    </Card>
  );
};
