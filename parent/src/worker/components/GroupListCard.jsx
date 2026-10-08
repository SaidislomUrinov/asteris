import { useTranslation } from "react-i18next";
import { HiOutlineClock, HiOutlineMapPin, HiChevronRight } from "react-icons/hi2";
import { Card, Pill } from "../../components/Card";
import { groupLabel } from "../utils";
import { DayChips } from "./DayChips";

const STATUS_TONE = { active: "ok", pending: "warn", finished: "mut" };

// Guruhlar ro'yxatidagi karta — bosilsa guruh detali.
export const GroupListCard = ({ group: g, showStatus, onClick }) => {
  const { t } = useTranslation();
  return (
    <Card as="button" type="button" onClick={onClick} className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2 w-full">
        <div className="font-extrabold text-[15.5px] leading-tight min-w-0 break-words">{groupLabel(g)}</div>
        <div className="flex items-center gap-1.5 shrink-0">
          {showStatus && <Pill tone={STATUS_TONE[g.status] || "mut"}>{t(`worker.group.status.${g.status}`)}</Pill>}
          <Pill tone="acc">{t("worker.today.students", { count: g.studentsCount || 0 })}</Pill>
          <HiChevronRight className="w-4 h-4 text-hint/70" />
        </div>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-hint font-semibold">
        {g.startTime && (
          <span className="inline-flex items-center gap-1 tabular">
            <HiOutlineClock className="w-4 h-4" />
            {g.startTime}–{g.endTime}
          </span>
        )}
        {g.roomName && (
          <span className="inline-flex items-center gap-1">
            <HiOutlineMapPin className="w-4 h-4" />
            {g.roomName}
          </span>
        )}
      </div>
      <DayChips days={g.days} />
    </Card>
  );
};
