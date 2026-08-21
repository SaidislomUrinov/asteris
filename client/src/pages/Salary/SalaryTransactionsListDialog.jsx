import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiTrash } from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Button from "../../ui/Button";
import Chip from "../../ui/Chip";
import NumberText from "../../ui/NumberText";
import ExportExcelButton from "../../ui/ExportExcelButton";
import useCan from "../../hooks/useCan";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";

const money = (v) => `${(v || 0).toLocaleString("uz-UZ")}`;

const TX_COLOR = { advance: "orange", withdrawal: "red", bonus: "emerald", penalty: "red" };

// "Tranzaksiyalar" — DropMenu'dan ochiladigan, faqat KO'RISH/bekor qilish
// uchun modal (Salary/index.jsx). Yangi tranzaksiya qo'shish endi bu yerda
// emas, alohida "To'lov/Jarima" modalida (SalaryTransactionDialog.jsx).
function SalaryTransactionsListDialog({ open, staff, month, onClose, onChanged }) {
  const { t } = useTranslation();
  const can = useCan();
  const canManage = can("salary:manage");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cancelingId, setCancelingId] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);

  const fetchDetail = useCallback(async () => {
    if (!staff?._id) return;
    try {
      setLoading(true);
      const res = await api.get(`/salaries/${staff._id}`, { params: { month } });
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setData(data);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setLoading(false);
    }
  }, [staff?._id, month]);

  useEffect(() => {
    if (open) fetchDetail();
  }, [open, fetchDetail]);

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    const txId = cancelTarget._id;
    try {
      setCancelingId(txId);
      const res = await api.patch(`/salaries/transactions/${txId}/cancel`);
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      setCancelTarget(null);
      fetchDetail();
      onChanged?.();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setCancelingId(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={`${t("salary.transactions")} — ${staff?.name || ""}`}>
      {loading || !data ? (
        <div className="flex items-center justify-center w-full h-40 text-slate-400 text-sm">
          {t("common.loading")}
        </div>
      ) : (
        <div className="flex flex-col gap-4 w-full">
          <div className="flex justify-end">
            <ExportExcelButton
              endpoint={`/salaries/${staff._id}/export`}
              params={{ month }}
              variant="icon"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 p-3 rounded-lg bg-slate-50">
              <span className="text-xs text-slate-400">{t("salary.base")}</span>
              <NumberText>{money(data.base)}</NumberText>
            </div>
            <div className="flex flex-col gap-1 p-3 rounded-lg bg-slate-50">
              <span className="text-xs text-slate-400">{t("salary.final")}</span>
              <NumberText className={data.final < 0 ? "text-red-600" : "text-emerald-600"}>
                {money(data.final)}
              </NumberText>
            </div>
            <div className="flex flex-col gap-1 p-3 rounded-lg bg-slate-50">
              <span className="text-xs text-slate-400">{t("salary.advance")}</span>
              <NumberText>{money(data.advance)}</NumberText>
            </div>
            <div className="flex flex-col gap-1 p-3 rounded-lg bg-slate-50">
              <span className="text-xs text-slate-400">{t("salary.withdrawal")}</span>
              <NumberText>{money(data.withdrawal)}</NumberText>
            </div>
            <div className="flex flex-col gap-1 p-3 rounded-lg bg-slate-50">
              <span className="text-xs text-slate-400">{t("salary.bonus")}</span>
              <NumberText className="text-emerald-600">{money(data.bonus)}</NumberText>
            </div>
            <div className="flex flex-col gap-1 p-3 rounded-lg bg-slate-50">
              <span className="text-xs text-slate-400">{t("salary.penalty")}</span>
              <NumberText className="text-red-600">
                {data.penalty ? `-${money(data.penalty)}` : money(0)}
              </NumberText>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-slate-700">{t("salary.transactions")}</p>
            {data.transactions.length === 0 ? (
              <p className="text-sm text-slate-400">{t("salary.noTransactions")}</p>
            ) : (
              data.transactions.map((tx) => {
                const cancelled = tx.status === "cancelled";
                return (
                  <div
                    key={tx._id}
                    className={`relative flex items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-100 ${
                      cancelled ? "opacity-50" : ""
                    }`}
                  >
                    {/* Bekor qilingan tranzaksiya ustidan to'liq gorizontal chiziq */}
                    {cancelled && (
                      <div className="absolute left-0 right-0 top-1/2 h-px bg-slate-400 -translate-y-1/2 pointer-events-none" />
                    )}
                    <div className="flex items-center gap-2">
                      <Chip value={t(`salary.txType.${tx.type}`)} color={TX_COLOR[tx.type]} />
                      <div className="flex flex-col">
                        <NumberText>
                          {tx.type === "penalty" ? `-${money(tx.amount)}` : money(tx.amount)}
                        </NumberText>
                        {tx.note && <span className="text-xs text-slate-400">{tx.note}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-slate-400 whitespace-nowrap">{tx.date}</span>
                      {/* Avans hech qachon bekor qilinmaydi — pul allaqachon
                      qo'lma-qo'l berib bo'lingan, tugmani ko'rsatish chalg'ituvchi */}
                      {canManage && tx.status === "active" && tx.type !== "advance" && (
                        <Button
                          variant="text"
                          color="red"
                          onClick={() => setCancelTarget(tx)}
                        >
                          <HiTrash className="text-base" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      <Dialog
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title={t("salary.cancelTxTitle")}
        zIndex="z-40"
        actions={
          <>
            <Button color="black" variant="text" onClick={() => setCancelTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button color="red" loading={!!cancelingId} onClick={confirmCancel}>
              {t("common.confirm")}
            </Button>
          </>
        }
      >
        <p>
          {t("salary.cancelTxConfirm", {
            type: cancelTarget ? t(`salary.txType.${cancelTarget.type}`) : "",
            amount: cancelTarget ? money(cancelTarget.amount) : "",
          })}
        </p>
      </Dialog>
    </Dialog>
  );
}

export default SalaryTransactionsListDialog;
