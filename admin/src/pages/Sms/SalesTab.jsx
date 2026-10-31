import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import List from "../../ui/List";
import socket from "../../socket";
import { api } from "../../utils/fetching";
import { errorMsg } from "../../utils/alert";
import { fmtNum, fmtUnix } from "./smsMeta";

// Sotuvlar: barcha client'lar to'lagan paketlar.
function SalesTab() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/sms/purchases", { params: { page } });
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

  // Yangi sotuv/sovg'a — jadval darhol yangilanadi.
  useEffect(() => {
    socket.on("sms:purchase", fetchRows);
    return () => socket.off("sms:purchase", fetchRows);
  }, [fetchRows]);

  const columns = [
    { key: "client", header: t("sms.client"), render: (row) => <span className="font-semibold text-slate-800">{row.clientName || "—"}</span> },
    { key: "center", header: t("sms.grant.center"), render: (row) => row.centerName || "—" },
    { key: "package", header: t("sms.packageName"), render: (row) => row.packageName },
    { key: "smsCount", header: t("sms.smsCount"), render: (row) => fmtNum(row.smsCount) },
    { key: "remaining", header: t("sms.remaining"), render: (row) => fmtNum(row.remaining) },
    { key: "price", header: t("sms.price"), render: (row) => `${fmtNum(row.price)} ${t("sms.som")}` },
    { key: "paidAt", header: t("sms.paidAt"), render: (row) => <span className="text-xs text-slate-500">{fmtUnix(row.paidAt)}</span> },
    { key: "expires", header: t("sms.expiresAt"), render: (row) => (row.expiresAt ? fmtUnix(row.expiresAt).slice(0, 10) : t("sms.unlimited")) },
  ];

  return (
    <List
      columns={columns}
      rows={rows}
      loading={loading}
      empty={t("sms.emptySales")}
      page={meta.page}
      totalPages={meta.totalPages}
      onPageChange={setPage}
      showPagination
    />
  );
}

export default SalesTab;
