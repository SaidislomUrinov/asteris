import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Chip from "../../ui/Chip";
import ProgressBar from "../../ui/ProgressBar";
import List from "../../ui/List";
import { api } from "../../utils/fetching";
import { errorMsg } from "../../utils/alert";
import { PURCHASE_COLOR, fmtNum, fmtUnix, fmtUnixDate } from "./smsFormat";

// Paketlarim: sotib olingan paketlar, qoldiq va tugash sanasi.
function SmsPurchasesTab({ refreshKey }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/sms/purchases", { params: { page } });
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
  }, [fetchRows, refreshKey]);

  const columns = [
    {
      key: "name",
      header: t("sms.packageName"),
      render: (row) => <span className="font-semibold text-slate-800 dark:text-slate-100">{row.packageName}</span>,
    },
    {
      key: "remaining",
      header: t("sms.remaining"),
      render: (row) => (
        <div className="flex flex-col gap-1 min-w-28">
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            {fmtNum(row.remaining)} <span className="font-normal text-slate-400 dark:text-slate-500">/ {fmtNum(row.smsCount)}</span>
          </span>
          {row.status === "paid" && <ProgressBar value={row.remaining} max={row.smsCount} color={row.remaining / row.smsCount < 0.1 ? "orange" : "blue"} />}
        </div>
      ),
    },
    { key: "price", header: t("sms.price"), render: (row) => `${fmtNum(row.price)} ${t("sms.som")}` },
    {
      key: "expires",
      header: t("sms.expiresAt"),
      render: (row) => (row.status === "paid" ? (row.expiresAt ? fmtUnixDate(row.expiresAt) : t("sms.unlimited")) : "—"),
    },
    {
      key: "date",
      header: t("sms.date"),
      render: (row) => (
        <span className="text-xs text-slate-500 dark:text-slate-400">{fmtUnix(row.paidAt || row.createdAt)}</span>
      ),
    },
    {
      key: "status",
      header: t("common.status"),
      render: (row) => <Chip value={t(`sms.purchaseStatus.${row.status}`)} color={PURCHASE_COLOR[row.status]} />,
    },
  ];

  return (
    <List
      columns={columns}
      rows={rows}
      loading={loading}
      empty={t("sms.emptyPurchases")}
      page={meta.page}
      totalPages={meta.totalPages}
      onPageChange={setPage}
      showPagination
    />
  );
}

export default SmsPurchasesTab;
