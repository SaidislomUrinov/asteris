import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Chip from "../../ui/Chip";
import List from "../../ui/List";
import Select from "../../ui/Select";
import { api } from "../../utils/fetching";
import { errorMsg } from "../../utils/alert";
import { TX_COLOR, fmtNum, fmtUnix } from "./smsFormat";

const TYPES = ["topup", "spend", "refund", "expire"];

// Balans tarixi: topup / spend / refund / expire.
function SmsTransactionsTab({ refreshKey }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/sms/transactions", { params: { page, type: type || undefined } });
      const { ok, data, meta: m, msg } = res.data;
      if (!ok) throw new Error(msg);
      setRows(data || []);
      setMeta(m || { page: 1, totalPages: 1 });
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setLoading(false);
    }
  }, [page, type]);

  useEffect(() => {
    const timer = setTimeout(fetchRows, 0);
    return () => clearTimeout(timer);
  }, [fetchRows, refreshKey]);

  const columns = [
    {
      key: "type",
      header: t("common.status"),
      render: (row) => <Chip value={t(`sms.txTypes.${row.type}`)} color={TX_COLOR[row.type]} />,
    },
    {
      key: "amount",
      header: t("sms.amount"),
      render: (row) => (
        <span className="font-semibold text-slate-800 dark:text-slate-100">
          {row.type === "topup" || row.type === "refund" ? "+" : "−"}
          {fmtNum(row.amount)}
        </span>
      ),
    },
    { key: "package", header: t("sms.packageName"), render: (row) => row.packageName || "—" },
    { key: "batch", header: t("sms.batchTitle"), render: (row) => row.batchTitle || "—" },
    {
      key: "date",
      header: t("sms.date"),
      render: (row) => <span className="text-xs text-slate-500 dark:text-slate-400">{fmtUnix(row.createdAt)}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="sm:max-w-60">
        <Select
          variant="slate"
          value={type}
          placeholder={t("common.all")}
          onChange={(v) => {
            setType(v);
            setPage(1);
          }}
          options={[
            { value: "", label: t("common.all") },
            ...TYPES.map((x) => ({ value: x, label: t(`sms.txTypes.${x}`) })),
          ]}
        />
      </div>
      <List
        columns={columns}
        rows={rows}
        loading={loading}
        empty={t("sms.emptyTransactions")}
        page={meta.page}
        totalPages={meta.totalPages}
        onPageChange={setPage}
        showPagination
      />
    </div>
  );
}

export default SmsTransactionsTab;
