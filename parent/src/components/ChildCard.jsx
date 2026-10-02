import { useTranslation } from "react-i18next";
import { HiChevronRight } from "react-icons/hi2";
import { Avatar, Card, Pill } from "./Card";
import { initials, money } from "../utils/format";

export const ChildCard = ({ child, index, onClick }) => {
  const { t } = useTranslation();
  const { student, stats, centers } = child;
  const linked = centers.filter((c) => c.linked);
  const groupCount = linked.reduce((a, c) => a + (c.groups || []).filter((g) => g.status === "active").length, 0);
  const centerNames = centers.map((c) => c.center.name).join(" · ");
  return (
    <Card as="button" onClick={onClick} className="flex items-center gap-3">
      <Avatar text={initials(student.fullName)} tone={index} className="w-11 h-11 text-[15px]" />
      <div className="flex-1 min-w-0">
        <div className="font-extrabold text-[15px] break-words leading-tight">
          {student.fullName}
          {student.isSelf && <span className="text-hint font-semibold text-xs"> · {t("child.self")}</span>}
        </div>
        <div className="text-xs text-hint mt-1 break-words leading-snug">
          {centerNames} · {t("child.groups", { count: groupCount })}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
          {stats.totalDebt > 0 ? (
            <Pill tone="bad">{t("common.debtShort", { v: money(stats.totalDebt) })}</Pill>
          ) : (
            <Pill tone="ok">{t("common.paid")}</Pill>
          )}
          {stats.attendancePercent != null && <Pill tone="mut">{stats.attendancePercent}%</Pill>}
        </div>
      </div>
      <HiChevronRight className="w-5 h-5 text-hint/70 shrink-0" />
    </Card>
  );
};
