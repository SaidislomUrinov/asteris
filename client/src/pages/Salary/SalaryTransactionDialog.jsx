import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiBanknotes } from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Button from "../../ui/Button";
import Input from "../../ui/Input";
import Select from "../../ui/Select";
import NumberText from "../../ui/NumberText";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import useFeature from "../../hooks/useFeature";
import useHideFinance from "../../hooks/useHideFinance";
import { maskMoney } from "../../utils/moneyFormat";

const TX_TYPES = ["advance", "withdrawal", "bonus", "penalty"];

// Premium turlar — tarif ochmagan bo'lsa tanlovdan chiqarib tashlanadi
// (backend `salary.service.js#addTransaction` baribir yakuniy tekshiradi).
const TX_TARIFF_FLAG = { advance: "staff.salary.advance", bonus: "staff.bonus" };

// "To'lov/Jarima" — DropMenu'dan alohida ochiladigan, faqat qo'shish uchun
// modal (Salary/index.jsx). Tranzaksiyalar tarixi/bekor qilish endi bu yerda
// emas, alohida "Tranzaksiyalar" modalida (SalaryTransactionsListDialog.jsx).
function SalaryTransactionDialog({ open, staff, month, onClose, onSaved }) {
  const { t } = useTranslation();
  const hasFeature = useFeature();
  const [hideFinance] = useHideFinance();
  const money = useCallback((v) => maskMoney(v, hideFinance), [hideFinance]);
  const availableTypes = TX_TYPES.filter((tp) => !TX_TARIFF_FLAG[tp] || hasFeature(TX_TARIFF_FLAG[tp]));
  const [form, setForm] = useState({ type: "advance", amount: "", note: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || availableTypes.includes(form.type)) return;
    const id = setTimeout(() => setForm((f) => ({ ...f, type: availableTypes[0] || "withdrawal" })), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Tranzaksiyalar tarixi modalidagi bilan bir xil statistika — foydalanuvchi
  // yangi tranzaksiya qo'shishdan oldin joriy holatni (hisoblangan oylik,
  // qolgan summa va h.k.) ko'rib turishi uchun.
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const staffId = staff?._id;
  const fetchStats = useCallback(async () => {
    if (!staffId) return;
    try {
      setStatsLoading(true);
      const res = await api.get(`/salaries/${staffId}`, { params: { month } });
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setStats(data);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setStatsLoading(false);
    }
  }, [staffId, month]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(fetchStats, 0);
    return () => clearTimeout(t);
  }, [open, fetchStats]);

  const submit = async () => {
    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      errorMsg("salary.invalidAmount");
      return;
    }
    try {
      setSaving(true);
      const res = await api.post(`/salaries/${staff._id}/transactions`, {
        type: form.type,
        amount,
        note: form.note,
        month,
      });
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      setForm({ type: "advance", amount: "", note: "" });
      onSaved?.();
      onClose();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`${t("salary.addTransaction")} — ${staff?.name || ""}`}
      actions={
        <>
          <Button color="black" variant="text" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button loading={saving} onClick={submit} className="gap-1.5">
            <HiBanknotes className="text-base" />
            {t("common.add")}
          </Button>
        </>
      }
    >
      <div onKeyDown={(k) => k.key === "Enter" && submit()} className="flex flex-col gap-4 w-full">
        {statsLoading || !stats ? (
          <div className="flex items-center justify-center w-full h-20 text-slate-400 text-sm">
            {t("common.loading")}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 p-3 rounded-lg bg-slate-50">
              <span className="text-xs text-slate-400">{t("salary.base")}</span>
              <NumberText>{money(stats.base)}</NumberText>
            </div>
            <div className="flex flex-col gap-1 p-3 rounded-lg bg-slate-50">
              <span className="text-xs text-slate-400">{t("salary.final")}</span>
              <NumberText className={stats.final < 0 ? "text-red-600" : "text-emerald-600"}>
                {money(stats.final)}
              </NumberText>
            </div>
            <div className="flex flex-col gap-1 p-3 rounded-lg bg-slate-50">
              <span className="text-xs text-slate-400">{t("salary.advance")}</span>
              <NumberText>{money(stats.advance)}</NumberText>
            </div>
            <div className="flex flex-col gap-1 p-3 rounded-lg bg-slate-50">
              <span className="text-xs text-slate-400">{t("salary.withdrawal")}</span>
              <NumberText>{money(stats.withdrawal)}</NumberText>
            </div>
            <div className="flex flex-col gap-1 p-3 rounded-lg bg-slate-50">
              <span className="text-xs text-slate-400">{t("salary.bonus")}</span>
              <NumberText className="text-emerald-600">{money(stats.bonus)}</NumberText>
            </div>
            <div className="flex flex-col gap-1 p-3 rounded-lg bg-slate-50">
              <span className="text-xs text-slate-400">{t("salary.penalty")}</span>
              <NumberText className="text-red-600">
                {stats.penalty ? `-${money(stats.penalty)}` : money(0)}
              </NumberText>
            </div>
          </div>
        )}

        <Select
          label={t("salary.txTypeLabel")}
          value={form.type}
          onChange={(v) => setForm((f) => ({ ...f, type: v }))}
          options={availableTypes.map((tp) => ({ value: tp, label: t(`salary.txType.${tp}`) }))}
        />
        <Input
          type="number"
          label={t("salary.amount")}
          placeholder={t("salary.amount")}
          required
          value={form.amount}
          onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
        />
        <Input
          label={t("salary.note")}
          placeholder={t("salary.note")}
          value={form.note}
          onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
        />
      </div>
    </Dialog>
  );
}

export default SalaryTransactionDialog;
