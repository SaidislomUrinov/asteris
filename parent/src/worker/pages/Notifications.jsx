import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { HiOutlineBell } from "react-icons/hi2";
import { WorkerPage } from "../components/WorkerPage";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { EmptyState, ErrorState } from "../../components/States";
import { ListSkeleton } from "../../components/Skeleton";
import { cn } from "../../utils/cn";
import { fmtDate, fmtTime } from "../../utils/format";
import { useWorker } from "../useWorker";
import { useSocketEvents } from "../useSocket";
import { workerApi } from "../api";
import { asErr, errText, notifText } from "../utils";

// Xabarlar: GET /notifications?page (client paneli bilan bir xil manba),
// PATCH /notifications/read-all va /:id/read. Yangi xabar socket orqali tepaga.
export const Notifications = () => {
  const { t } = useTranslation();
  const { unread, setUnread } = useWorker();
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [state, setState] = useState({ loading: true, error: null, more: false });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (page = 1) => {
    setState((s) => ({ ...s, loading: page === 1, more: page > 1, error: null }));
    try {
      const res = await workerApi.notifications(page);
      setItems((prev) => (page === 1 ? res.data || [] : [...prev, ...(res.data || [])]));
      setMeta(res.meta || null);
      if (typeof res.unread === "number") setUnread(res.unread);
      setState({ loading: false, error: null, more: false });
    } catch (e) {
      setState({ loading: false, error: e, more: false });
    }
  }, [setUnread]);

  useEffect(() => {
    const id = setTimeout(() => load(1), 0);
    return () => clearTimeout(id);
  }, [load]);

  useSocketEvents(["notification:new"], (_ev, n) => {
    if (n?._id) setItems((prev) => (prev.some((x) => x._id === n._id) ? prev : [n, ...prev]));
  });

  const readAll = async () => {
    setBusy(true);
    try {
      await workerApi.readAll();
      setItems((prev) => prev.map((x) => ({ ...x, read: true })));
      setUnread(0);
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const readOne = async (n) => {
    if (n.read) return;
    setItems((prev) => prev.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
    setUnread(Math.max(0, unread - 1));
    try {
      await workerApi.readOne(n._id);
    } catch {
      /* keyingi yuklashda server holati ko'rinadi */
    }
  };

  const page = meta?.page || 1;
  const hasMore = meta && page < (meta.totalPages || 1);

  return (
    <WorkerPage title={t("worker.notif.title")}>
      {unread > 0 && (
        <div className="flex justify-end -mt-1">
          <Button variant="soft" className="w-auto py-2 px-3 text-[13px]" loading={busy} onClick={readAll}>
            {t("worker.notif.readAll")}
          </Button>
        </div>
      )}
      {state.loading ? (
        <ListSkeleton count={5} />
      ) : state.error && !items.length ? (
        <ErrorState error={asErr(state.error)} onRetry={() => load(1)} />
      ) : items.length === 0 ? (
        <EmptyState icon={HiOutlineBell} title={t("worker.notif.empty")} text={t("worker.notif.emptyText")} />
      ) : (
        <>
          <Card className="py-1 divide-y divide-line/70">
            {items.map((n) => (
              <button
                key={n._id}
                type="button"
                onClick={() => readOne(n)}
                className="w-full flex items-start gap-2.5 py-2.5 text-left"
              >
                <span className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", n.read ? "bg-transparent" : "bg-accent")} />
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-[14px] break-words", n.read ? "font-semibold" : "font-extrabold")}>{notifText(n.title, n.data)}</span>
                  {n.body && <span className="block text-[13px] text-hint break-words whitespace-pre-line">{notifText(n.body, n.data)}</span>}
                </span>
                <span className="tabular text-[11px] text-hint shrink-0 text-right">
                  {fmtDate(n.createdAt)}
                  <br />
                  {fmtTime(n.createdAt)}
                </span>
              </button>
            ))}
          </Card>
          {hasMore && (
            <Button variant="soft" loading={state.more} onClick={() => load(page + 1)}>
              {t("common.loadMore")}
            </Button>
          )}
        </>
      )}
    </WorkerPage>
  );
};
