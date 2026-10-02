import { HiOutlineCheckCircle, HiOutlineClock, HiOutlineXCircle } from "react-icons/hi2";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AttendanceCalendar } from "../../components/AttendanceCalendar";
import { StatRow } from "../../components/StatRow";
import { Card } from "../../components/Card";
import { Skeleton } from "../../components/Skeleton";
import { ErrorState } from "../../components/States";
import { useRequest } from "../../hooks/useRequest";
import { getAttendance } from "../../api/parent";
import { fmtDateFull, shiftMonth, ymOf } from "../../utils/format";

export const AttendanceTab = ({ entryId }) => {
  const { t } = useTranslation();
  const [month, setMonth] = useState(ymOf());
  const [selected, setSelected] = useState(null);
  const { data, loading, error, reload } = useRequest(() => getAttendance(entryId, month), [entryId, month]);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  const first = loading && !data;
  const s = data?.summary || {};
  const sel = selected && data?.days?.find((d) => d.date === selected.date);

  return (
    <>
      {first ? (
        <Skeleton className="h-[340px] rounded-2xl" />
      ) : (
        <AttendanceCalendar
          month={month}
          days={data?.days || []}
          lessonDays={data?.lessonDays || []}
          loading={loading}
          selected={selected?.date}
          onSelectDay={(c) => setSelected(c)}
          onMonthChange={(d) => { setSelected(null); setMonth((m) => shiftMonth(m, d)); }}
        />
      )}
      <StatRow
        items={[
          { icon: HiOutlineCheckCircle, value: s.present ?? "—", label: t("att.present"), tone: "ok" },
          { icon: HiOutlineClock, value: s.excused ?? "—", label: t("att.excused"), tone: "warn" },
          { icon: HiOutlineXCircle, value: s.absent ?? "—", label: t("att.absent"), tone: "bad" },
        ]}
      />
      {s.late > 0 && <div className="text-xs text-hint px-1 -mt-1">{t("att.lateCount", { n: s.late })}</div>}
      {selected && (
        <Card>
          <div className="text-[11px] font-bold uppercase tracking-wider text-hint">
            {fmtDateFull(selected.date)} · {sel ? t(`att.${sel.status}`) : t("att.notMarked")}
            {sel?.late && ` · ${t("att.late")}`}
          </div>
          <div className="text-sm text-hint mt-1">
            {sel?.status === "absent" && (sel.reason || t("att.absentHint"))}
            {sel?.status === "excused" && (sel.reason || t("att.excusedHint"))}
            {sel?.status === "present" && t("att.presentHint")}
            {!sel && t("att.notMarkedHint")}
          </div>
        </Card>
      )}
    </>
  );
};
