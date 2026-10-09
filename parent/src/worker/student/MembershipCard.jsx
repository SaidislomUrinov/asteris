import { useTranslation } from "react-i18next";
import { HiChevronRight, HiOutlineBanknotes } from "react-icons/hi2";
import { Card, Pill } from "../../components/Card";
import { fmtMonth, money } from "../../utils/format";
import { cn } from "../../utils/cn";

const MAX_ROWS = 6;

// A'zolik holati: guruh yakunlangan bo'lsa — "Yakunlangan", aks holda
// a'zolik statusi (faol / chiqqan).
const stateOf = (e) => (e.groupStatus === "finished" ? "finished" : e.status === "left" ? "left" : "active");
const TONE = { active: "ok", left: "mut", finished: "mut" };

// O'quvchining bitta guruhdagi a'zoligi (details §3.1): nom, holat, oylik
// narx, joriy qarz (oy kesimida `debtBreakdown`), "To'lov" tugmasi.
export const MembershipCard = ({ entry: e, name, showMoney, onOpenGroup, onPay }) => {
  const { t } = useTranslation();
  const st = stateOf(e);
  const rows = (e.debtBreakdown || []).filter((r) => r.debt > 0);
  return (
    <Card className={cn("flex flex-col gap-2.5", showMoney && e.debt > 0 && st === "active" && "border-bad/40")}>
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          disabled={!onOpenGroup}
          onClick={onOpenGroup}
          className="min-w-0 text-left flex items-center gap-1 font-title font-bold text-[15px] break-words disabled:cursor-default"
        >
          <span className="min-w-0 break-words">{name}</span>
          {onOpenGroup && <HiChevronRight className="w-4 h-4 text-hint shrink-0" />}
        </button>
        <Pill tone={TONE[st]} className="shrink-0">{t(`worker.student.entry.${st}`)}</Pill>
      </div>
      {showMoney && (
        <>
          <div className="flex items-center justify-between gap-2 text-[13px] pt-2 border-t border-line/70">
            <span className="text-hint">{t("worker.student.price")}</span>
            <span className="tabular font-bold">{money(e.price)} <span className="font-sans">{t("common.sum")}</span></span>
          </div>
          {e.debt > 0 ? (
            <div className="rounded-xl bg-bad-bg text-bad px-3 py-2.5 flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2 text-[14px] font-bold">
                <span>{t("worker.pay.debt")}</span>
                <span className="tabular">{money(e.debt)} <span className="font-sans">{t("common.sum")}</span></span>
              </div>
              {rows.slice(0, MAX_ROWS).map((r, i) => (
                <div key={`${r.month}-${r.from || i}`} className="flex items-center justify-between gap-2 text-[12.5px] opacity-90 pt-1 border-t border-bad/15">
                  <span>{r.kind === "opening" && !r.month ? t("worker.student.opening") : fmtMonth(r.month)}</span>
                  <span className="tabular">{money(r.debt)}</span>
                </div>
              ))}
              {rows.length > MAX_ROWS && (
                <div className="text-[11px] opacity-80">{t("worker.student.moreMonths", { count: rows.length - MAX_ROWS })}</div>
              )}
            </div>
          ) : (
            <div className="rounded-xl bg-ok-bg text-ok px-3 py-2.5 text-[13px] font-bold">{t("worker.pay.noDebt")}</div>
          )}
        </>
      )}
      {onPay && (
        <button
          type="button"
          onClick={onPay}
          className="self-start inline-flex items-center gap-1.5 px-3.5 h-10 rounded-xl bg-accent text-accent-fg text-[13px] font-bold active:opacity-80"
        >
          <HiOutlineBanknotes className="w-4 h-4" />
          {t("worker.student.pay")}
        </button>
      )}
    </Card>
  );
};
