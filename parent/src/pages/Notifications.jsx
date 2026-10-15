import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiOutlineBellSlash } from "react-icons/hi2";
import { Page } from "../components/Page";
import { Card, Divider, SectionLabel } from "../components/Card";
import { NotificationItem } from "../components/NotificationItem";
import { ListSkeleton } from "../components/Skeleton";
import { EmptyState, ErrorState } from "../components/States";
import { Button } from "../components/Button";
import { useRequest } from "../hooks/useRequest";
import { getNotifications, readAllNotifications } from "../api/parent";
import { fmtDateFull, toDate, todayStr, ymOf } from "../utils/format";
import { cn } from "../utils/cn";
import { useAuth } from "../contexts/auth";
import { useRoleT } from "../hooks/useRoleT";

const FILTERS = ["", "parent:attendance", "parent:lessonFinished", "parent:homeworkMissed", "parent:payment", "parent:debt", "parent:badge", "parent:coin"];
// O'quvchi roliga keladigan turlar (kontrakt §5)
const STUDENT_FILTERS = ["", "parent:lessonFinished", "parent:homework", "parent:homeworkMissed", "parent:lessonReminder", "parent:badge", "parent:coin", "parent:shop"];

const dayKey = (ts) => {
  const d = toDate(ts);
  return `${ymOf(d)}-${String(d.getDate()).padStart(2, "0")}`;
};

export const Notifications = () => {
  const { t } = useTranslation();
  const rt = useRoleT();
  const { isStudent } = useAuth();
  const filters = isStudent ? STUDENT_FILTERS : FILTERS;
  const [type, setType] = useState("");
  const [extra, setExtra] = useState({ items: [], page: 1, loading: false });
  const { data, loading, error, reload } = useRequest(() => getNotifications(1, type), [type]);
  const acc = useMemo(() => [...(data?.data || []), ...extra.items], [data, extra.items]);

  const loadMore = async () => {
    setExtra((e) => ({ ...e, loading: true }));
    try {
      const res = await getNotifications(extra.page + 1, type);
      setExtra((e) => ({ items: [...e.items, ...res.data], page: e.page + 1, loading: false }));
    } catch {
      setExtra((e) => ({ ...e, loading: false }));
    }
  };
  useEffect(() => {
    // Sahifa ochilganda hammasi o'qilgan deb belgilanadi (best-effort)
    readAllNotifications().catch(() => {});
  }, []);

  const groups = useMemo(() => {
    const today = todayStr();
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yesterday = dayKey(y);
    const map = new Map();
    for (const n of acc) {
      const k = dayKey(n.createdAt);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(n);
    }
    return [...map.entries()].map(([k, items]) => ({
      key: k,
      label: k === today ? t("notif.today") : k === yesterday ? t("notif.yesterday") : fmtDateFull(k),
      items,
    }));
  }, [acc, t]);

  const changeType = (v) => { setType(v); setExtra({ items: [], page: 1, loading: false }); };
  const hasMore = data?.meta && extra.page < data.meta.totalPages;

  return (
    <Page title={t("tab.notifications")}>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => changeType(f)}
            className={cn("shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-bold border transition-colors", type === f ? "bg-accent text-accent-fg border-accent" : "bg-card text-hint border-line/70")}
          >
            {t(f ? `notif.type.${f.split(":")[1]}` : "notif.all")}
          </button>
        ))}
      </div>
      {loading && !data ? (
        <ListSkeleton count={4} />
      ) : error && acc.length === 0 ? (
        <ErrorState error={error} onRetry={reload} />
      ) : acc.length === 0 ? (
        <EmptyState icon={HiOutlineBellSlash} title={t("notif.empty")} text={rt("notif.emptyText")} />
      ) : (
        <>
          {groups.map((g) => (
            <div key={g.key} className="space-y-2">
              <SectionLabel>{g.label}</SectionLabel>
              <Card>
                {g.items.map((n, i) => (
                  <div key={n._id}>
                    {i > 0 && <Divider />}
                    <NotificationItem n={n} />
                  </div>
                ))}
              </Card>
            </div>
          ))}
          {hasMore && <Button variant="soft" loading={extra.loading} onClick={loadMore}>{t("common.loadMore")}</Button>}
        </>
      )}
    </Page>
  );
};
