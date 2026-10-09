import { useTranslation } from "react-i18next";
import { HiOutlineArrowTopRightOnSquare, HiOutlineBanknotes } from "react-icons/hi2";
import { Card, Divider, SectionLabel, Pill } from "../../components/Card";
import { DebtBox } from "../../components/DebtBox";
import { ListSkeleton, Skeleton } from "../../components/Skeleton";
import { EmptyState, ErrorState } from "../../components/States";
import { useRequest } from "../../hooks/useRequest";
import { getEntryPayments } from "../../api/parent";
import { fmtDate, fmtMonth, money } from "../../utils/format";
import { openLink } from "../../lib/telegram";
import { cn } from "../../utils/cn";

export const PaymentsTab = ({ entryId }) => {
  const { t } = useTranslation();
  const { data, loading, error, reload } = useRequest(() => getEntryPayments(entryId), [entryId]);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data) return <><Skeleton className="h-28 rounded-2xl" /><ListSkeleton count={3} /></>;

  const list = data?.payments || [];
  return (
    <>
      <DebtBox debt={data?.debt} breakdown={data?.debtBreakdown} nextDueDate={data?.nextDueDate} price={data?.price} />
      <SectionLabel>{t("payments.history")}</SectionLabel>
      {list.length === 0 ? (
        <EmptyState icon={HiOutlineBanknotes} title={t("payments.empty")} />
      ) : (
        <Card>
          {list.map((p, i) => (
            <div key={p._id}>
              {i > 0 && <Divider className="my-2" />}
              <div className={cn("flex items-center gap-3", p.status !== "active" && "opacity-60")}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold tabular">
                    {money(p.amount)} <span className="font-sans">{t("common.sum")}</span>
                    {p.status === "refunded" && <Pill tone="warn" className="ml-2 font-sans">{t("payments.refunded")}</Pill>}
                    {p.status === "cancelled" && <Pill tone="mut" className="ml-2 font-sans">{t("payments.cancelled")}</Pill>}
                  </div>
                  <div className="text-xs text-hint mt-0.5 break-words">
                    {[fmtDate(p.date), t(`payments.type.${p.type}`, { defaultValue: p.type }), p.forMonth ? fmtMonth(p.forMonth) : null, p.collectedByName].filter(Boolean).join(" · ")}
                  </div>
                </div>
                {p.code && data?.receiptVerifyBase && (
                  <button
                    type="button"
                    onClick={() => openLink(`${data.receiptVerifyBase}/${p.code}`)}
                    className="shrink-0 flex items-center gap-1 text-xs font-bold text-accent bg-accent/10 rounded-lg px-2 py-1.5"
                  >
                    {t("payments.receipt")} <HiOutlineArrowTopRightOnSquare className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </Card>
      )}
    </>
  );
};
