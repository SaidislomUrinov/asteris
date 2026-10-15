import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiPlus, HiReceiptPercent, HiTrash } from "react-icons/hi2";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import Button from "../../ui/Button";
import IconButton from "../../ui/IconButton";

const MAX_ROWS = 12;
const MAX_MONTHS = 36;
const MAX_PERCENT = 90;

// Qatorlarni server bilan bir xil qoidada tekshiradi — xato kaliti yoki null.
const validate = (rows) => {
  if (rows.length === 0) return "tariff.discountsEmpty";
  const seen = new Set();
  for (const r of rows) {
    const m = Number(r.months);
    const p = Number(r.percent);
    if (r.months === "" || !Number.isInteger(m) || m < 1 || m > MAX_MONTHS) return "tariff.discountsInvalid";
    if (r.percent === "" || !Number.isFinite(p) || p < 0 || p > MAX_PERCENT) return "tariff.discountsInvalid";
    if (seen.has(m)) return "tariff.discountsDuplicate";
    seen.add(m);
  }
  return null;
};

const toRows = (items) => items.map((i) => ({ months: String(i.months), percent: String(i.percent) }));

/**
 * Obuna muddati chegirmalari — barcha tariflar uchun umumiy jadval
 * (docs/API_CONTRACT_tariff_discounts.md). `GET/PUT /tariffs/discounts`.
 */
export default function DurationDiscountsCard() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [saved, setSaved] = useState("[]");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await api.get("/tariffs/discounts");
        const { ok, data, msg } = res.data;
        if (!ok) throw new Error(msg);
        const next = toRows(data.items || []);
        setRows(next);
        setSaved(JSON.stringify(next));
      } catch (error) {
        errorMsg(error.message);
      } finally {
        setLoading(false);
      }
    };
    const id = setTimeout(run, 0);
    return () => clearTimeout(id);
  }, []);

  const dirty = JSON.stringify(rows) !== saved;
  const errorKey = validate(rows);

  const setCell = (i, field, value) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value.replace(/[^\d.]/g, "") } : r)));

  const addRow = () => {
    const used = new Set(rows.map((r) => Number(r.months)));
    const next = [1, 3, 6, 9, 12, 18, 24, 36].find((m) => !used.has(m)) || "";
    setRows((prev) => [...prev, { months: String(next), percent: "0" }]);
  };

  const save = async () => {
    try {
      setSaving(true);
      const items = rows.map((r) => ({ months: Number(r.months), percent: Number(r.percent) }));
      const res = await api.put("/tariffs/discounts", { items });
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      const next = toRows(data.items);
      setRows(next);
      setSaved(JSON.stringify(next));
      successMsg(msg);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setSaving(false);
    }
  };

  const fieldCls =
    "flex items-center gap-1.5 flex-1 min-w-0 h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 focus-within:border-blue-500 focus-within:bg-white transition-colors";
  const inputCls = "w-full min-w-0 bg-transparent outline-none text-sm font-semibold text-slate-800 text-right";

  return (
    <div className="flex flex-col gap-4 w-full bg-white border border-slate-200 rounded-xl p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex items-center justify-center w-9 h-9 shrink-0 rounded-lg bg-emerald-50 text-emerald-600 text-lg">
            <HiReceiptPercent />
          </span>
          <p className="font-semibold text-slate-800">{t("tariff.discountsTitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <Button variant="outlined" color="slate" onClick={() => setRows(JSON.parse(saved))} disabled={saving}>
              {t("common.cancel")}
            </Button>
          )}
          <Button onClick={save} loading={saving} disabled={!dirty || !!errorKey}>
            {t("common.save")}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[58px] rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-xl border border-slate-200">
              <label className={fieldCls}>
                <input
                  inputMode="numeric"
                  value={r.months}
                  onChange={(e) => setCell(i, "months", e.target.value)}
                  aria-label={t("tariff.discountMonths")}
                  className={inputCls}
                />
                <span className="text-xs text-slate-500 shrink-0">{t("tariff.discountMonthsShort")}</span>
              </label>
              <span className="text-slate-300 shrink-0">→</span>
              <label className={`${fieldCls} focus-within:border-emerald-500`}>
                <input
                  inputMode="decimal"
                  value={r.percent}
                  onChange={(e) => setCell(i, "percent", e.target.value)}
                  aria-label={t("tariff.discountPercent")}
                  className={`${inputCls} !text-emerald-700`}
                />
                <span className="text-xs text-slate-500 shrink-0">%</span>
              </label>
              <IconButton
                variant="ghost"
                color="red"
                onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                disabled={rows.length <= 1}
                aria-label={t("common.delete")}
              >
                <HiTrash />
              </IconButton>
            </div>
          ))}
          {rows.length < MAX_ROWS && (
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center justify-center gap-1.5 min-h-[58px] px-3 rounded-xl border border-dashed border-slate-300 text-sm font-semibold text-slate-500 hover:border-blue-400 hover:text-blue-600 cursor-pointer transition-colors"
            >
              <HiPlus />
              {t("tariff.discountAdd")}
            </button>
          )}
        </div>
      )}

      {!loading && errorKey && <p className="text-xs text-red-500">{t(errorKey)}</p>}
    </div>
  );
}
