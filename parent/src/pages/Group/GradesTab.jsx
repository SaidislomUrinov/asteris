import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiOutlineEyeSlash, HiOutlineStar, HiOutlineChartBar, HiOutlineTrophy } from "react-icons/hi2";
import { Card, Divider } from "../../components/Card";
import { MonthNav } from "../../components/MonthNav";
import { StatRow } from "../../components/StatRow";
import { ListSkeleton } from "../../components/Skeleton";
import { EmptyState, ErrorState } from "../../components/States";
import { useRequest } from "../../hooks/useRequest";
import { getGrades } from "../../api/parent";
import { fmtDate, ymOf } from "../../utils/format";
import { useRoleT } from "../../hooks/useRoleT";
import { cn } from "../../utils/cn";

const gradeTone = (v) => (v >= 8 ? "bg-ok-bg text-ok" : v >= 6 ? "bg-warn-bg text-warn" : "bg-bad-bg text-bad");

export const GradesTab = ({ entryId }) => {
  const { t } = useTranslation();
  const rt = useRoleT();
  const [month, setMonth] = useState(ymOf());
  const { data, loading, error, reload } = useRequest(() => getGrades(entryId, month), [entryId, month]);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  const items = data?.items || [];

  return (
    <>
      <MonthNav month={month} onChange={setMonth} />
      {loading && !data ? (
        <ListSkeleton count={3} />
      ) : data?.gradesHidden ? (
        <EmptyState icon={HiOutlineEyeSlash} title={t("grades.hidden")} text={rt("grades.hiddenText")} />
      ) : (
        <>
          <StatRow
            items={[
              { icon: HiOutlineChartBar, value: data?.avg != null ? data.avg : "—", label: t("grades.avg") },
              { icon: HiOutlineStar, value: items.length, label: t("grades.count") },
              { icon: HiOutlineTrophy, value: items.length ? Math.max(...items.map((i) => i.value)) : "—", label: t("grades.best"), tone: "ok" },
            ]}
          />
          {items.length === 0 ? (
            <EmptyState icon={HiOutlineStar} title={t("grades.empty")} />
          ) : (
            <Card className={cn(loading && "opacity-60")}>
              {items.map((it, i) => (
                <div key={`${it.date}-${i}`}>
                  {i > 0 && <Divider className="my-1.5" />}
                  <div className="flex items-center gap-3 py-0.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm break-words">
                        <span className="text-hint">{fmtDate(it.date)}</span>
                        {it.topic && <span className="text-ink"> · {it.topic}</span>}
                      </div>
                      {it.note && <div className="text-xs text-hint mt-0.5 break-words">{it.note}</div>}
                    </div>
                    <span className={cn("w-8 h-8 rounded-lg grid place-items-center font-extrabold text-sm shrink-0 tabular", gradeTone(it.value))}>{it.value}</span>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </>
  );
};
