import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { HiOutlineBanknotes, HiOutlineWallet, HiChevronRight } from "react-icons/hi2";
import { Page } from "../components/Page";
import { Avatar, Card, Divider, SectionLabel } from "../components/Card";
import { ListSkeleton, Skeleton } from "../components/Skeleton";
import { EmptyState, ErrorState } from "../components/States";
import { useRequest } from "../hooks/useRequest";
import { getPayments } from "../api/parent";
import { fmtDate, fmtDateFull, fmtMonth, initials, money } from "../utils/format";
import { cn } from "../utils/cn";
import { photoSrc } from "../lib/studentPhoto";

export const Payments = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useRequest(getPayments, []);
  const studentIdx = {};
  const idx = (id) => (studentIdx[id] ??= Object.keys(studentIdx).length);

  return (
    <Page title={t("tab.payments")}>
      {loading ? (
        <><Skeleton className="h-[118px] rounded-2xl" /><Skeleton className="h-3 w-20 mt-1" /><ListSkeleton count={2} /><Skeleton className="h-3 w-28 mt-1" /><ListSkeleton count={3} /></>
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <>
          <Card className={cn("border-transparent p-4", data.totalDebt > 0 ? "bg-hero text-hero-fg" : "bg-ok-bg text-ok")}>
            <div className="flex items-center gap-2">
              <span className={cn("w-7 h-7 rounded-lg grid place-items-center", data.totalDebt > 0 ? "bg-white/10" : "bg-ok/12")}><HiOutlineWallet className="w-4 h-4" /></span>
              <div className={cn("text-[11px] font-bold uppercase tracking-[0.08em]", data.totalDebt > 0 ? "text-hero-fg-mut" : "opacity-70")}>
                {t("payments.totalDebt")}
              </div>
            </div>
            <div className={cn("text-[28px] font-extrabold tabular mt-2 leading-none", data.totalDebt > 0 && "text-[#ff6b6b]")}>
              {money(data.totalDebt)} <span className="text-base font-bold opacity-80">{t("common.sum")}</span>
            </div>
            {data.totalDebt > 0 ? (
              <div className="text-sm text-hero-fg-mut mt-2">
                {t("payments.debtGroups", { n: data.debts.length })}
                {data.debts[0]?.nextDueDate && ` · ${t("payments.dueShort", { d: fmtDateFull(data.debts[0].nextDueDate) })}`}
              </div>
            ) : (
              <div className="text-sm opacity-80 mt-2">{t("payments.noDebtAll")}</div>
            )}
          </Card>

          {data.debts.length > 0 && (
            <>
              <SectionLabel>{t("payments.debts")}</SectionLabel>
              <div className="space-y-2.5">
                {data.debts.map((d) => (
                  <Card as="button" key={d.entryId} onClick={() => navigate(`/child/${d.student._id}/group/${d.entryId}/payments`)} className="flex items-center gap-3">
                    <Avatar text={initials(d.student.fullName)} tone={idx(d.student._id)} src={photoSrc(d.student.photo)} alt={d.student.fullName} />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm break-words">{d.student.fullName.split(" ")[0]} · {d.groupName}</div>
                      <div className="text-xs text-hint break-words">{d.centerName}{d.nextDueDate && ` · ${t("payments.dueShort", { d: fmtDate(d.nextDueDate) })}`}</div>
                    </div>
                    <div className="font-extrabold text-bad tabular shrink-0 text-right leading-tight">{money(d.debt)} <span className="text-[11px] font-bold">{t("common.sum")}</span></div>
                    <HiChevronRight className="w-4 h-4 text-hint/70 shrink-0" />
                  </Card>
                ))}
              </div>
            </>
          )}

          {data.months.length === 0 ? (
            <EmptyState icon={HiOutlineBanknotes} title={t("payments.empty")} />
          ) : (
            data.months.map((m) => (
              <div key={m.month} className="space-y-2.5">
                <SectionLabel>{fmtMonth(m.month)}</SectionLabel>
                <Card>
                  {m.items.map((p, i) => (
                    <div key={`${p.code || i}`}>
                      {i > 0 && <Divider className="my-2" />}
                      <div className="flex items-center gap-3">
                        <Avatar text={initials(p.student.fullName)} tone={idx(p.student._id)} src={photoSrc(p.student.photo)} alt={p.student.fullName} className="w-9 h-9" />
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm break-words">{p.student.fullName.split(" ")[0]} · {p.groupName}</div>
                          <div className="text-xs text-hint break-words">{[fmtDate(p.date), t(`payments.type.${p.type}`, { defaultValue: p.type }), p.centerName].filter(Boolean).join(" · ")}</div>
                        </div>
                        <div className="font-extrabold tabular shrink-0 text-right leading-tight">{money(p.amount)} <span className="text-[11px] font-bold text-hint">{t("common.sum")}</span></div>
                      </div>
                    </div>
                  ))}
                </Card>
              </div>
            ))
          )}
        </>
      )}
    </Page>
  );
};
