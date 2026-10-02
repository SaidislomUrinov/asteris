import { useTranslation } from "react-i18next";
import { Card, Divider, KV } from "./Card";
import { fmtDateFull, fmtMonth, money } from "../utils/format";

// Qarz qutisi: oylar kesimida, jami, keyingi muddat.
export const DebtBox = ({ debt, breakdown = [], nextDueDate, price }) => {
  const { t } = useTranslation();
  const rows = breakdown.filter((b) => b.debt > 0);
  if (!debt || debt <= 0) {
    return (
      <Card className="border-[1.5px] border-ok/50">
        <div className="text-[11px] font-bold uppercase tracking-wider text-ok">{t("payments.noDebt")}</div>
        {price != null && <div className="text-sm text-hint mt-1">{t("payments.pricePerMonth", { v: money(price) })}</div>}
        {nextDueDate && <div className="text-sm text-hint">{t("payments.nextDue", { d: fmtDateFull(nextDueDate) })}</div>}
      </Card>
    );
  }
  return (
    <Card className="border-[1.5px] border-bad">
      <div className="text-[11px] font-bold uppercase tracking-wider text-bad">{t("payments.debt")}</div>
      <div className="mt-1">
        {rows.map((b, i) => (
          <KV key={i} label={fmtMonth(b.month)} value={`${money(b.debt)} ${t("common.sum")}`} valueClassName="text-bad" />
        ))}
      </div>
      <Divider className="my-1.5" />
      <KV label={t("common.total")} value={`${money(debt)} ${t("common.sum")}`} valueClassName="text-bad text-base" />
      {nextDueDate && <div className="text-sm text-hint mt-1">{t("payments.nextDue", { d: fmtDateFull(nextDueDate) })}</div>}
    </Card>
  );
};
