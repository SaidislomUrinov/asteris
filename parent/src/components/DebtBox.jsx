import { useTranslation } from "react-i18next";
import { Card, Divider, KV } from "./Card";
import { Num } from "./Num";
import { fmtDate, fmtDateFull, fmtMonth, money } from "../utils/format";

// Sikl oralig'i ("20-oktabr – 25-oktabr") — bir oyda ikki qator bo'lsa ajratadi.
const rangeOf = (b) => (b.kind === "cycle" && b.from && b.to ? `${fmtDate(b.from)} – ${fmtDate(b.to)}` : "");

// Qarz qutisi: oylar kesimida, jami, keyingi muddat.
export const DebtBox = ({ debt, breakdown = [], nextDueDate, price }) => {
  const { t } = useTranslation();
  const rows = breakdown.filter((b) => b.debt > 0);
  if (!debt || debt <= 0) {
    return (
      <Card className="border-[1.5px] border-ok/50">
        <div className="text-[11px] font-bold uppercase tracking-wider text-ok">{t("payments.noDebt")}</div>
        {price != null && <div className="text-sm text-hint mt-1"><Num text={t("payments.pricePerMonth", { v: money(price) })} v={money(price)} /></div>}
        {nextDueDate && <div className="text-sm text-hint">{t("payments.nextDue", { d: fmtDateFull(nextDueDate) })}</div>}
      </Card>
    );
  }
  return (
    <Card className="border-[1.5px] border-bad">
      <div className="text-[11px] font-bold uppercase tracking-wider text-bad">{t("payments.debt")}</div>
      <div className="mt-1">
        {rows.map((b, i) => (
          <KV
            key={i}
            label={
              <>
                {fmtMonth(b.month)}
                {rangeOf(b) && <span className="block text-[11px] text-hint font-sans">{rangeOf(b)}</span>}
              </>
            }
            value={<>{money(b.debt)} <span className="font-sans">{t("common.sum")}</span></>}
            valueClassName="tabular text-bad"
          />
        ))}
      </div>
      <Divider className="my-1.5" />
      <KV label={t("common.total")} value={<>{money(debt)} <span className="font-sans">{t("common.sum")}</span></>} valueClassName="tabular text-bad text-base" />
      {nextDueDate && <div className="text-sm text-hint mt-1">{t("payments.nextDue", { d: fmtDateFull(nextDueDate) })}</div>}
    </Card>
  );
};
