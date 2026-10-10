import { useTranslation } from "react-i18next";
import { HiChevronRight } from "react-icons/hi2";
import { Avatar, Card, Pill } from "./Card";
import { Num } from "./Num";
import { initials, money } from "../utils/format";
import { photoSrc } from "../lib/studentPhoto";

export const ChildCard = ({ child, index, onClick }) => {
  const { t } = useTranslation();
  const { student, stats, centers } = child;
  const linked = centers.filter((c) => c.linked);
  const active = linked.flatMap((c) => (c.groups || []).filter((g) => g.status === "active"));
  // Individual dars guruh sifatida sanalmaydi — alohida ko'rsatiladi.
  const individualCount = active.filter((g) => g.isIndividual).length;
  const groupCount = active.length - individualCount;
  const summary = [
    centers.map((c) => c.center.name).join(" · "),
    (groupCount > 0 || !individualCount) && t("child.groups", { count: groupCount }),
    individualCount > 0 && t("child.individuals", { count: individualCount }),
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Card as="button" onClick={onClick} className="flex items-center gap-3">
      <Avatar text={initials(student.fullName)} tone={index} src={photoSrc(student.photo)} alt={student.fullName} className="w-11 h-11 text-[15px]" />
      <div className="flex-1 min-w-0">
        <div className="font-title font-bold text-[15px] break-words leading-tight">
          {student.fullName}
          {student.isSelf && <span className="text-hint font-semibold text-xs font-sans"> · {t("child.self")}</span>}
        </div>
        <div className="text-xs text-hint mt-1 break-words leading-snug">
          {summary}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
          {stats.totalDebt > 0 ? (
            <Pill tone="bad"><Num text={t("common.debtShort", { v: money(stats.totalDebt) })} v={money(stats.totalDebt)} /></Pill>
          ) : (
            <Pill tone="ok">{t("common.paid")}</Pill>
          )}
          {stats.attendancePercent != null && <Pill tone="mut" className="tabular">{stats.attendancePercent}%</Pill>}
        </div>
      </div>
      <HiChevronRight className="w-5 h-5 text-hint/70 shrink-0" />
    </Card>
  );
};
