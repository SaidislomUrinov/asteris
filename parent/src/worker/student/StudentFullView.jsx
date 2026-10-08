import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { HiOutlineBanknotes, HiOutlineUserGroup } from "react-icons/hi2";
import { Card, SectionLabel } from "../../components/Card";
import { CardsSkeleton, HeaderCardSkeleton } from "../components/WorkerSkeleton";
import { EmptyState, ErrorState } from "../../components/States";
import { haptic } from "../../lib/telegram";
import { useWorker } from "../useWorker";
import { useScopedLive } from "../useScopedLive";
import { useGroupNames } from "../useGroupNames";
import { workerApi } from "../api";
import { asErr } from "../utils";
import { ReadOnlyNote } from "../components/ReadOnlyNote";
import { StudentProfileCard } from "./StudentProfileCard";
import { MembershipCard } from "./MembershipCard";
import { PaymentRow } from "./PaymentRow";
import { StudySummary } from "./StudySummary";

const EVENTS = [
  "payment:created",
  "payment:cancelled",
  "payment:updated",
  "student:updated",
  "student:priceUpdated",
  "student:leftGroup",
  "student:enrolled",
  "attendance:marked",
];

// To'lanadigan a'zolik (PaymentSheet bilan bir xil qoida).
const payable = (e) => e.groupStatus !== "finished" && (e.status === "active" || (e.debt || 0) > 0);

// Boshliq / resepshn uchun o'quvchi detali (details §3.1). Manba:
// GET /students/:id (client StudentDetail bilan bir xil DTO). Bekor qilish /
// oy o'tkazish WebApp'da yo'q (brauzerda qoladi).
export const StudentFullView = ({ id }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can, readOnly, openSheet } = useWorker();

  const load = useCallback(() => workerApi.student(id), [id]);
  const { data: s, loading, error, reload } = useScopedLive(load, [load], {
    events: EVENTS,
    match: (_ev, p) => p?.studentId === id || p?.student?._id === id,
  });

  const entries = useMemo(() => s?.groups || [], [s]);
  const nameOf = useGroupNames(entries.map((e) => e.group));
  const canPay = can("payment:create");
  const showMoney = can("payment:view");

  const pay = (entryId) => {
    if (readOnly) {
      haptic("warning");
      toast.info(t("worker.readOnly.fab"), { id: "ro-fab" });
      return;
    }
    haptic("medium");
    openSheet("payment", { student: s, entryId });
  };

  const payments = useMemo(
    () =>
      entries
        .flatMap((e) => (e.payments || []).map((p) => ({ p, group: e.group })))
        .sort((a, b) => (b.p.date || 0) - (a.p.date || 0)),
    [entries],
  );

  if (loading && !s) {
    return (
      <>
        <HeaderCardSkeleton />
        <CardsSkeleton count={2} />
      </>
    );
  }
  if (error && !s) return <ErrorState error={asErr(error)} onRetry={reload} />;
  if (!s) return null;

  const anyPayable = canPay && entries.some(payable);
  return (
    <>
      {readOnly && <ReadOnlyNote />}
      <StudentProfileCard
        student={s}
        canCall={can("student:contact") || can("student:view")}
        onPay={anyPayable ? () => pay(null) : undefined}
        payDisabled={readOnly}
      />

      <SectionLabel>{t("worker.student.groups")}</SectionLabel>
      {entries.length === 0 ? (
        <EmptyState icon={HiOutlineUserGroup} title={t("worker.student.noGroups")} />
      ) : (
        entries.map((e) => (
          <MembershipCard
            key={e._id}
            entry={e}
            name={nameOf(e.group)}
            showMoney={showMoney}
            onOpenGroup={can("group:view") ? () => navigate(`/groups/${e.group}`) : undefined}
            onPay={canPay && payable(e) ? () => pay(e._id) : undefined}
          />
        ))
      )}

      {can("attendance:view") && (
        <StudySummary studentId={id} groups={entries.map((e) => ({ id: String(e.group), name: nameOf(e.group) }))} />
      )}

      {showMoney && (
        <>
          <SectionLabel>{t("worker.student.payments")}</SectionLabel>
          {payments.length === 0 ? (
            <EmptyState icon={HiOutlineBanknotes} title={t("worker.student.noPayments")} />
          ) : (
            <Card className="py-1 px-3.5 divide-y divide-line/70">
              {payments.map(({ p, group }) => (
                <PaymentRow key={p._id} payment={p} groupName={nameOf(group)} />
              ))}
            </Card>
          )}
        </>
      )}
    </>
  );
};
