import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Button from "../../ui/Button";
import Chip from "../../ui/Chip";
import Dialog from "../../ui/Dialog";
import List from "../../ui/List";
import { api } from "../../utils/fetching";
import { errorMsg } from "../../utils/alert";
import { STATUS_COLOR, TOPIC_COLOR, fmtUnix } from "./smsMeta";

function BatchLogs({ batch, onClose }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    if (!batch) return;
    try {
      setLoading(true);
      const res = await api.get(`/admin/sms/batches/${batch._id}`, { params: { page } });
      const { ok, data, meta: m, msg } = res.data;
      if (!ok) throw new Error(msg);
      setRows(data || []);
      setMeta(m || { page: 1, totalPages: 1 });
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setLoading(false);
    }
  }, [batch, page]);

  useEffect(() => {
    const timer = setTimeout(fetchLogs, 0);
    return () => clearTimeout(timer);
  }, [fetchLogs]);

  const columns = [
    {
      key: "student",
      header: t("sms.recipient"),
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-800">{row.studentName}</span>
          <span className="text-xs text-slate-400">{row.phone}</span>
        </div>
      ),
    },
    { key: "text", header: t("sms.text"), render: (row) => <span className="block w-64 text-xs text-slate-600 whitespace-normal leading-relaxed">{row.text || "—"}</span> },
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
      title={batch ? `${batch.clientName} · ${batch.centerName}` : ""}
      actions={
        <Button color="black" variant="text" onClick={onClose}>
          {t("common.close")}
        </Button>
      }
    >
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
    </Dialog>
  );
}

function HistoryTab() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/sms/batches", { params: { page } });
      const { ok, data, meta: m, msg } = res.data;
      if (!ok) throw new Error(msg);
      setRows(data || []);
      setMeta(m || { page: 1, totalPages: 1 });
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    const timer = setTimeout(fetchRows, 0);
    return () => clearTimeout(timer);
  }, [fetchRows]);

  const columns = [
    {
      key: "center",
      header: t("sms.center"),
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-800">{row.clientName || "—"}</span>
          <span className="text-xs text-slate-400">{row.centerName || "—"}</span>
        </div>
      ),
    },
    {
      key: "template",
      header: t("sms.template"),
      render: (row) => (
        <div className="flex flex-col items-start gap-1">
          <span>{row.templateTitle}</span>
          <Chip value={t(`sms.topics.${row.topic}`)} color={TOPIC_COLOR[row.topic]} />
        </div>
      ),
    },
    {
      key: "result",
      header: t("sms.result"),
      render: (row) => (
        <span className="text-xs">
          {t("sms.resultLine", { sent: row.sent, delivered: row.delivered, failed: row.failed, total: row.total })}
        </span>
      ),
    },
    { key: "by", header: t("sms.sentBy"), render: (row) => row.createdBy?.name || "—" },
    { key: "date", header: t("sms.startedAt"), render: (row) => <span className="text-xs">{fmtUnix(row.startedAt)}</span> },
    {
      key: "status",
      header: t("common.status"),
      render: (row) => <Chip value={t(`sms.batchStatus.${row.status}`)} color={STATUS_COLOR[row.status]} />,
    },
    {
      key: "open",
      header: "",
      className: "text-right",
      render: (row) => (
        <Button variant="text" onClick={() => setSelected(row)}>
          {t("sms.details")}
        </Button>
      ),
    },
  ];

  return (
    <>
      <List
        columns={columns}
        rows={rows}
        loading={loading}
        empty={t("sms.empty")}
        page={meta.page}
        totalPages={meta.totalPages}
        onPageChange={setPage}
        showPagination
      />
      <BatchLogs key={selected?._id || "none"} batch={selected} onClose={() => setSelected(null)} />
    </>
  );
}

export default HistoryTab;
