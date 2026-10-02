import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiOutlineBookOpen } from "react-icons/hi2";
import { MonthNav } from "../../components/MonthNav";
import { HomeworkCard } from "../../components/HomeworkCard";
import { SectionLabel } from "../../components/Card";
import { ListSkeleton } from "../../components/Skeleton";
import { EmptyState, ErrorState } from "../../components/States";
import { useRequest } from "../../hooks/useRequest";
import { getHomework } from "../../api/parent";
import { ymOf, todayStr } from "../../utils/format";
import { cn } from "../../utils/cn";

// Uyga vazifalar — oy bo'yicha. Kelayotganlar (bugundan boshlab, o'sish
// tartibida) tepada, o'tganlar pastda alohida, xiralashtirilgan bo'limda
// (yangisidan eskisiga).
export const HomeworkTab = ({ entryId }) => {
  const { t } = useTranslation();
  const [month, setMonth] = useState(ymOf());
  const { data, loading, error, reload } = useRequest(() => getHomework(entryId, month), [entryId, month]);
  const items = data?.items || [];

  const { upcoming, past } = useMemo(() => {
    const list = data?.items || [];
    const today = todayStr();
    const up = list.filter((i) => i.date >= today).sort((a, b) => a.date.localeCompare(b.date));
    const pa = list.filter((i) => i.date < today).sort((a, b) => b.date.localeCompare(a.date));
    return { upcoming: up, past: pa };
  }, [data]);

  return (
    <>
      <MonthNav month={month} onChange={setMonth} />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <ListSkeleton count={3} />
      ) : items.length === 0 ? (
        <EmptyState icon={HiOutlineBookOpen} title={t("hw.empty")} text={t("hw.emptyText")} />
      ) : (
        <div className={cn("space-y-3", loading && "opacity-60")}>
          {upcoming.length > 0 && (
            <div className="space-y-2.5">
              {upcoming.map((it) => <HomeworkCard key={it.date} item={it} />)}
            </div>
          )}
          {past.length > 0 && (
            <div className="space-y-2.5">
              <SectionLabel>{t("hw.past")}</SectionLabel>
              {past.map((it) => <HomeworkCard key={it.date} item={it} />)}
            </div>
          )}
        </div>
      )}
    </>
  );
};
