import { useTranslation } from "react-i18next";
import { HiOutlineClock, HiPhoto, HiArrowUturnLeft, HiShoppingBag, HiSparkles, HiGift } from "react-icons/hi2";
import { Card, Pill, SectionLabel } from "../../components/Card";
import { EmptyState, ErrorState } from "../../components/States";
import { ListSkeleton } from "../../components/Skeleton";
import { CoinIcon } from "../../components/CoinIcon";
import { useRequest } from "../../hooks/useRequest";
import { getCoinHistory } from "../../api/parent";
import { photoSrc } from "../../lib/studentPhoto";
import { fmtTime, fmtMonth, fmtDate, toDate, ymOf } from "../../utils/format";
import { cn } from "../../utils/cn";

const ORDER_TONE = { pending: "warn", delivered: "ok", refunded: "mut" };
const TX_ICON = { earn: HiSparkles, spend: HiShoppingBag, refund: HiArrowUturnLeft, adjust: HiGift };
const PARTS = ["grades", "homework", "attendance", "medals"];

// Tranzaksiya qaysi oyga tegishli: earn — `month`, qolganlari — yaratilgan oy.
const monthOf = (tx) => tx.month || ymOf(toDate(tx.createdAt) || new Date());

// Xaridlar (holati bilan) va tanga harakati tarixi.
export const HistoryTab = ({ wallet }) => {
  const { t } = useTranslation();
  const sid = wallet.student._id;
  const cid = wallet.center._id;
  const { data, loading, error, reload } = useRequest(() => getCoinHistory(sid, cid), [sid, cid, wallet.balance]);

  if (loading) return <ListSkeleton count={3} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const orders = data?.orders || [];
  const txs = data?.transactions || [];
  // Oydan oyga: yangi oy tepada, har oyda jami o'zgarish.
  const groups = [];
  for (const tx of txs) {
    const ym = monthOf(tx);
    let g = groups.find((x) => x.ym === ym);
    if (!g) groups.push((g = { ym, items: [], sum: 0 }));
    g.items.push(tx);
    g.sum += tx.amount;
  }
  groups.sort((a, b) => b.ym.localeCompare(a.ym));
  if (!orders.length && !txs.length) return <EmptyState icon={HiOutlineClock} title={t("coins.historyEmpty")} text={t("coins.historyEmptyText")} />;

  return (
    <>
      {orders.length > 0 && (
        <>
          <SectionLabel>{t("coins.myOrders")}</SectionLabel>
          <div className="space-y-2">
            {orders.map((o) => (
              <Card key={o._id} className={cn("flex items-center gap-3", o.status === "pending" && "border-amber-400/50 ring-1 ring-amber-400/20")}>
                <div className="w-12 h-12 rounded-xl bg-ink/6 overflow-hidden grid place-items-center shrink-0">
                  {o.productPhoto ? (
                    <img src={photoSrc(o.productPhoto)} alt="" loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <HiPhoto className="w-5 h-5 text-hint/60" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold break-words">{o.productName}</div>
                  <div className="flex items-center gap-1 text-[12px] text-hint mt-0.5">
                    <CoinIcon size={13} />
                    <span className="font-bold tabular-nums">{o.price}</span>
                    <span>· {fmtDate(o.createdAt)}</span>
                  </div>
                </div>
                <Pill tone={ORDER_TONE[o.status]}>{t(`coins.orderStatus.${o.status}`)}</Pill>
              </Card>
            ))}
          </div>
        </>
      )}

      {groups.map((g) => (
        <div key={g.ym} className="flex flex-col gap-2">
          <SectionLabel
            right={
              <span className={cn("inline-flex items-center gap-1 text-[12px] font-extrabold tabular-nums", g.sum > 0 ? "text-ok" : "text-hint")}>
                {g.sum > 0 ? `+${g.sum}` : g.sum}
                <CoinIcon size={13} />
              </span>
            }
          >
            {fmtMonth(g.ym)}
          </SectionLabel>
          <Card className="divide-y divide-line/70 py-1">
            {g.items.map((tx) => {
              const Icon = TX_ICON[tx.type] || HiSparkles;
              const plus = tx.amount > 0;
              const parts = tx.breakdown ? PARTS.filter((p) => tx.breakdown[p]?.coins > 0) : [];
              return (
                <div key={tx._id} className="flex items-start gap-3 py-2.5">
                  <div
                    className={cn(
                      "w-9 h-9 rounded-xl grid place-items-center shrink-0",
                      tx.type === "earn" || (tx.type === "adjust" && tx.amount > 0) ? "bg-amber-400/15 text-amber-600 dark:text-amber-400" : "bg-ink/6 text-hint",
                    )}
                  >
                    <Icon className="w-[18px] h-[18px]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold break-words">
                      {tx.type === "earn" ? t("coins.tx.earn", { month: fmtMonth(tx.month) }) : t(`coins.tx.${tx.type}`)}
                    </div>
                    {parts.length > 0 ? (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {parts.map((p) => (
                          <span key={p} className="px-1.5 py-0.5 rounded-md bg-ink/5 text-[11px] font-semibold text-hint tabular-nums">
                            {t(`coins.part.${p}`)} +{tx.breakdown[p].coins}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[12px] text-hint mt-0.5 break-words">
                        {tx.reason ? `${tx.reason} · ` : ""}
                        {fmtDate(tx.createdAt)} · {fmtTime(tx.createdAt)}
                      </div>
                    )}
                  </div>
                  <div className={cn("text-[15px] font-extrabold tabular-nums shrink-0", plus ? "text-ok" : "text-ink")}>
                    {plus ? `+${tx.amount}` : tx.amount}
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      ))}
    </>
  );
};
