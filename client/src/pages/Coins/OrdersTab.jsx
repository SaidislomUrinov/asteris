import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiCheck, HiArrowUturnLeft, HiOutlineShoppingBag, HiPhoto } from "react-icons/hi2";
import Button from "../../ui/Button";
import Avatar from "../../ui/Avatar";
import Dialog from "../../ui/Dialog";
import CoinAmount from "./CoinAmount";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import { photoSrc } from "../../utils/studentPhoto";

const STATUSES = ["pending", "delivered", "refunded"];
const STATUS_STYLE = {
  pending: "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300",
  delivered: "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  refunded: "bg-slate-100 dark:bg-night-800 text-slate-500 dark:text-slate-400",
};

const pad = (n) => String(n).padStart(2, "0");
const toMs = (ts) => (ts < 1e12 ? ts * 1000 : ts);
const fmtStamp = (ts) => {
  if (!ts) return "";
  const d = new Date(toMs(ts));
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * Do'kon buyurtmalari — yangi xarid realtime keladi (`shop:order`), xodim
 * "Topshirildi" yoki "Qaytarish" (tanga qaytadi) bosadi.
 *
 * @param {Object} props
 * @param {string} props.centerId
 * @param {boolean} props.canManage - `coin:manage`
 * @param {(n: number) => void} [props.onPendingChange] - tab nishoni uchun
 */
function OrdersTab({ centerId, canManage, onPendingChange }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState("pending");
  const [orders, setOrders] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, delivered: 0, refunded: 0 });
  const [meta, setMeta] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(null);
  const [refundOf, setRefundOf] = useState(null);

  const load = useCallback(
    async (page = 1) => {
      try {
        if (page === 1) setLoading(true);
        setError(false);
        const res = await api.get(`/shop/${centerId}/orders`, { params: { status, page } });
        const { ok, data, meta: m, counts: c, msg } = res.data;
        if (!ok) throw new Error(msg);
        setOrders((prev) => (page === 1 ? data : [...prev, ...data]));
        setMeta(m);
        setCounts(c);
      } catch (err) {
        errorMsg(err.message);
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [centerId, status],
  );

  useEffect(() => {
    const id = setTimeout(() => load(1), 0);
    return () => clearTimeout(id);
  }, [load]);

  useEffect(() => {
    onPendingChange?.(counts.pending);
  }, [counts.pending, onPendingChange]);

  // Yangi buyurtma — ro'yxat boshiga, sanoq yangilanadi.
  useSocketEvent(
    "shop:order",
    (p) => {
      const order = p?.order;
      if (!order || order.centerId !== centerId) return;
      setCounts((c) => ({ ...c, pending: c.pending + 1 }));
      if (status === "pending") setOrders((prev) => (prev.some((o) => o._id === order._id) ? prev : [order, ...prev]));
    },
    !!centerId,
  );

  useSocketEvent(
    "shop:orderUpdated",
    (p) => {
      const order = p?.order;
      if (!order || order.centerId !== centerId) return;
      setOrders((prev) => {
        const had = prev.find((o) => o._id === order._id);
        if (had && had.status === "pending" && order.status !== "pending") {
          setCounts((c) => ({ ...c, pending: Math.max(0, c.pending - 1), [order.status]: (c[order.status] || 0) + 1 }));
        }
        if (status === "pending") return prev.filter((o) => o._id !== order._id);
        return prev.map((o) => (o._id === order._id ? order : o));
      });
    },
    !!centerId,
  );

  const act = async (order, action) => {
    try {
      setBusy(order._id);
      const res = await api.patch(`/shop/${centerId}/orders/${order._id}/${action}`);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      setCounts((c) => ({ ...c, pending: Math.max(0, c.pending - 1), [data.status]: (c[data.status] || 0) + 1 }));
      setOrders((prev) => (status === "pending" ? prev.filter((o) => o._id !== order._id) : prev.map((o) => (o._id === order._id ? data : o))));
      setRefundOf(null);
    } catch (err) {
      errorMsg(err.message);
      if (err.message === "shop.orderNotPending") load(1);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-3 flex-1">
      <div className="flex items-center gap-1.5 flex-wrap">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[13px] font-semibold cursor-pointer transition-colors ${
              status === s
                ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
                : "bg-white dark:bg-night-900 border border-slate-200 dark:border-night-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-night-800"
            }`}
          >
            {t(`coins.orderStatus.${s}`)}
            <span
              className={`min-w-5 h-5 px-1.5 grid place-items-center rounded-full text-[11px] font-bold tabular-nums ${
                s === "pending" && counts.pending > 0
                  ? "bg-amber-500 text-white"
                  : status === s
                    ? "bg-white/20 dark:bg-slate-900/15"
                    : "bg-slate-100 dark:bg-night-800 text-slate-500 dark:text-slate-400"
              }`}
            >
              {counts[s] || 0}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-slate-100 dark:bg-night-800 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-sm text-slate-400 dark:text-slate-500">
          {t("common.error")}
          <Button variant="outlined" color="slate" onClick={() => load(1)}>
            {t("common.retry")}
          </Button>
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-14 text-slate-400 dark:text-slate-500">
          <HiOutlineShoppingBag className="text-3xl text-slate-300 dark:text-slate-600" />
          <span className="text-sm">{t(`coins.ordersEmpty.${status}`)}</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {orders.map((o) => (
            <div
              key={o._id}
              className={`relative overflow-hidden flex items-center gap-3 p-3 rounded-2xl border max-sm:flex-wrap ${
                o.status === "pending"
                  ? "pl-4 bg-white dark:bg-night-900 border-amber-200 dark:border-amber-500/30 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none"
                  : "bg-white/70 dark:bg-night-900/70 border-slate-200/80 dark:border-night-700/80"
              }`}
            >
              {o.status === "pending" && <span className="absolute inset-y-0 left-0 w-1 bg-amber-400" />}
              <div className="w-16 h-16 max-sm:w-14 max-sm:h-14 shrink-0 rounded-xl overflow-hidden bg-slate-100 dark:bg-night-800 grid place-items-center">
                {o.productPhoto ? (
                  <img src={photoSrc(o.productPhoto)} alt="" className="w-full h-full object-cover" />
                ) : (
                  <HiPhoto className="text-xl text-slate-300 dark:text-slate-600" />
                )}
              </div>
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <span className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 truncate">{o.productName}</span>
                <div className="flex items-center gap-1.5 min-w-0 text-[12px] text-slate-500 dark:text-slate-400">
                  <Avatar user={{ _id: o.student._id, name: o.student.fullName, avatar: o.student.photo }} size={18} preview={false} />
                  <span className="truncate font-medium text-slate-700 dark:text-slate-200">{o.student.fullName}</span>
                  <span className="shrink-0">· {fmtStamp(o.createdAt)}</span>
                </div>
                <CoinAmount value={o.price} size={15} className="text-sm" />
                {o.status !== "pending" && (
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                    {[o.handledBy?.name, fmtStamp(o.handledAt)].filter(Boolean).join(" · ")}
                  </span>
                )}
              </div>
              {o.status === "pending" && canManage ? (
                <div className="flex items-center gap-2 shrink-0 max-sm:w-full max-sm:grid max-sm:grid-cols-[auto_1fr]">
                  <Button variant="ghost" color="slate" className="max-sm:w-full" onClick={() => setRefundOf(o)} disabled={busy === o._id}>
                    <HiArrowUturnLeft className="text-base" />
                    {t("coins.refund")}
                  </Button>
                  <Button color="emerald" className="max-sm:w-full px-6" loading={busy === o._id} onClick={() => act(o, "deliver")}>
                    <HiCheck className="text-base" />
                    {t("coins.deliver")}
                  </Button>
                </div>
              ) : (
                <span className={`shrink-0 px-2.5 py-1 rounded-lg text-[12px] font-semibold ${STATUS_STYLE[o.status]}`}>
                  {t(`coins.orderStatus.${o.status}`)}
                </span>
              )}
            </div>
          ))}
          {meta.page < meta.totalPages && (
            <div className="flex justify-center pt-1">
              <Button variant="outlined" color="slate" onClick={() => load(meta.page + 1)}>
                {t("coins.loadMore")}
              </Button>
            </div>
          )}
        </div>
      )}

      <Dialog
        open={!!refundOf}
        onClose={() => setRefundOf(null)}
        title={t("coins.refundTitle")}
        widthClass="md:w-110"
        actions={
          <>
            <Button variant="ghost" color="slate" onClick={() => setRefundOf(null)}>
              {t("common.cancel")}
            </Button>
            <Button color="red" loading={busy === refundOf?._id} onClick={() => act(refundOf, "refund")}>
              {t("coins.refund")}
            </Button>
          </>
        }
      >
        {refundOf && (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {t("coins.refundText", { name: refundOf.student.fullName, product: refundOf.productName, price: refundOf.price })}
          </p>
        )}
      </Dialog>
    </div>
  );
}

export default OrdersTab;
