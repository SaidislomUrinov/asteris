import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { HiOutlineUserGroup } from "react-icons/hi2";
import { SegmentTabs } from "../../components/SegmentTabs";
import { EmptyState, ErrorState } from "../../components/States";
import { CardsSkeleton } from "../components/WorkerSkeleton";
import { useWorker } from "../useWorker";
import { useLive } from "../useLive";
import { loadAllGroups } from "../loadAllGroups";
import { asErr } from "../utils";
import { TEACHING_ROLES } from "../constants";
import { WorkerPage } from "../components/WorkerPage";
import { CenterChips } from "../components/CenterChips";
import { GroupListCard } from "../components/GroupListCard";

const STATUSES = ["active", "pending", "finished"];
const toMin = (hhmm) => (hhmm ? Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5)) : 9999);

// Guruhlar: GET /groups?status&center (o'qituvchi/yordamchida server
// `teacherScope` faqat o'ziniki qaytaradi). Soat bo'yicha tartib; bosilsa
// guruh detali (details §1).
export const Groups = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { role, centerId } = useWorker();
  const [status, setStatus] = useState("active");
  const load = useCallback(
    () => loadAllGroups({ status, center: centerId || undefined }),
    [status, centerId],
  );
  const { data, loading, error, reload } = useLive(load, [load]);
  const rows = [...(data || [])].sort((a, b) => toMin(a.startTime) - toMin(b.startTime));
  const mine = TEACHING_ROLES.includes(role);

  return (
    <WorkerPage
      title={t(mine ? "worker.groups.title" : "worker.groups.titleAll")}
      subtitle={!loading && !error ? t("worker.groups.countAny", { count: rows.length }) : null}
    >
      <SegmentTabs
        items={STATUSES.map((s) => ({ value: s, label: t(`worker.group.status.${s}`) }))}
        value={status}
        onChange={setStatus}
      />
      <CenterChips />
      {loading ? (
        <CardsSkeleton count={4} />
      ) : error ? (
        <ErrorState error={asErr(error)} onRetry={reload} />
      ) : rows.length === 0 ? (
        <EmptyState icon={HiOutlineUserGroup} title={t("worker.groups.emptyAny")} />
      ) : (
        rows.map((g) => <GroupListCard key={g._id} group={g} onClick={() => navigate(`/groups/${g._id}`)} />)
      )}
    </WorkerPage>
  );
};
