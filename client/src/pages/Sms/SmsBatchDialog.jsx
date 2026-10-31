import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiArrowPath } from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Button from "../../ui/Button";
import Chip from "../../ui/Chip";
import List from "../../ui/List";
import Select from "../../ui/Select";
import { api } from "../../utils/fetching";
import { errorMsg } from "../../utils/alert";
import { STATUS_COLOR, fmtUnix } from "./smsFormat";

const STATUSES = ["queued", "sent", "delivered", "failed", "skipped"];

function SmsBatchDialog({ batch, onClose }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLogs = useCallback(async () => {
    if (!batch) return;
    try {
      setLoading(true);
      const res = await api.get(`/sms/batches/${batch._id}`, { params: { page, status } });
      const { ok, data, meta: m, msg } = res.data;
      if (!ok) throw new Error(msg);
      setRows(data || []);
      setMeta(m || { page: 1, totalPages: 1 });
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setLoading(false);
    }
  }, [batch, page, status]);

  useEffect(() => {
    const timer = setTimeout(fetchLogs, 0);
    return () => clearTimeout(timer);
  }, [fetchLogs]);

  const refresh = async () => {
    try {
      setRefreshing(true);
      await api.post(`/sms/batches/${batch._id}/refresh`);
      await fetchLogs();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setRefreshing(false);
    }
  };

  const columns = [
    {
      key: "student",
      header: t("sms.recipient"),
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-800 dark:text-slate-100">{row.studentName}</span>
          <span className="text-xs text-slate-400 dark:text-slate-500">{row.phone}</span>
        </div>
      ),
    },
    {
      key: "text",
      header: t("sms.text"),
      render: (row) => <span className="text-xs text-slate-600 dark:text-slate-300">{row.text || "—"}</span>,
    },
    {
      key: "status",
      header: t("common.status"),
      render: (row) => (
        <div className="flex flex-col items-start gap-1">
          <Chip value={t(`sms.logStatus.${row.status}`)} color={STATUS_COLOR[row.status]} />
          {row.error && <span className="text-[11px] text-red-500">{row.error}</span>}
        </div>
      ),
    },
  ];

  return (
    <Dialog
      open={!!batch}
      onClose={onClose}
      title={batch?.templateTitle || t("sms.history")}
      widthClass="md:w-215"
      actions={
        <Button color="black" variant="text" onClick={onClose}>
          {t("common.close")}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2.5 [&>*]:min-w-[160px]">
          <Select
            variant="slate"
            placeholder={t("common.status")}
            value={status}
            onChange={(v) => {
              setPage(1);
              setStatus(v);
            }}
            options={[{ value: "", label: t("common.all") }, ...STATUSES.map((s) => ({ value: s, label: t(`sms.logStatus.${s}`) }))]}
          />
          <div className="!min-w-0 ml-auto">
            <Button variant="outlined" loading={refreshing} onClick={refresh} className="gap-1.5">
              <HiArrowPath className="text-base" />
              {t("sms.refreshStatus")}
            </Button>
          </div>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          {t("sms.startedAt")}: {fmtUnix(batch?.startedAt)}
        </p>
        <List
          columns={columns}
          rows={rows}
          loading={loading}
          empty={t("sms.emptyLogs")}
          page={meta.page}
          totalPages={meta.totalPages}
          onPageChange={setPage}
          showPagination
        />
      </div>
    </Dialog>
  );
}

export default SmsBatchDialog;
