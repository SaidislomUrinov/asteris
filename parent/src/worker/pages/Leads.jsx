import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiOutlineFunnel } from "react-icons/hi2";
import { WorkerPage } from "../components/WorkerPage";
import { Card, Pill } from "../../components/Card";
import { SegmentTabs } from "../../components/SegmentTabs";
import { EmptyState, ErrorState } from "../../components/States";
import { ListSkeleton } from "../../components/Skeleton";
import { fmtDate } from "../../utils/format";
import { useWorker } from "../useWorker";
import { useLive } from "../useLive";
import { workerApi } from "../api";
import { asErr } from "../utils";
import { ListRow } from "../components/ListRow";

// "open" — server default (yangi + bog'lanilgan), boshqalari aniq status.
const FILTERS = ["open", "new", "contacted"];
const STATUS_TONE = { new: "acc", contacted: "warn", enrolled: "ok", rejected: "mut" };

// Resepshn — Lidlar: GET /student-leads?status=&center= (client /leads bilan bir xil).
export const Leads = () => {
  const { t } = useTranslation();
  const { centerId } = useWorker();
  const [filter, setFilter] = useState("open");
  const load = useCallback(
    () => workerApi.leads({ status: filter === "open" ? undefined : filter, center: centerId || undefined }),
    [filter, centerId],
  );
  const { data, loading, error, reload } = useLive(load, [load]);
  const rows = data?.data || data || [];

  return (
    <WorkerPage title={t("worker.leads.title")} subtitle={data?.meta ? t("worker.leads.total", { count: data.meta.total }) : null}>
      <SegmentTabs
        items={FILTERS.map((f) => ({ value: f, label: t(`worker.leads.filter.${f}`) }))}
        value={filter}
        onChange={setFilter}
      />
      {loading ? (
        <ListSkeleton count={5} />
      ) : error ? (
        <ErrorState error={asErr(error)} onRetry={reload} />
      ) : rows.length === 0 ? (
        <EmptyState icon={HiOutlineFunnel} title={t("worker.leads.empty")} text={t("worker.leads.emptyText")} />
      ) : (
        <Card className="py-1 divide-y divide-line/70">
          {rows.map((l) => (
            <ListRow
              key={l._id}
              title={l.fullName}
              sub={[l.phone, l.source && t(`worker.leads.source.${l.source}`, { defaultValue: l.source }), fmtDate(l.date || l.createdAt)]
                .filter(Boolean)
                .join(" · ")}
              right={<Pill tone={STATUS_TONE[l.status] || "mut"} className="font-sans">{t(`worker.leads.status.${l.status}`, { defaultValue: l.status })}</Pill>}
              onClick={l.phone ? () => { window.location.href = `tel:${l.phone}`; } : undefined}
            />
          ))}
        </Card>
      )}
    </WorkerPage>
  );
};
