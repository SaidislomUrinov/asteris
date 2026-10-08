import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { HiOutlineCalendarDays, HiOutlinePlus, HiOutlineTrash } from "react-icons/hi2";
import Input from "../../ui/Input";
import Select from "../../ui/Select";
import Button from "../../ui/Button";
import IconButton from "../../ui/IconButton";
import NumberText from "../../ui/NumberText";
import {
  OPENING_MAX_ROWS,
  formatAmount,
  formatMonthName,
  openingTotal,
  parseAmount,
  recentMonths,
  validateOpeningRows,
} from "./openingDebts.util";

// Boshlang'ich (ko'chirishdan oldingi) qarz — oylar kesimida (DESIGN_opening_debts.md §1).
// Controlled: `value = { openingDebts: [{ month, amount, note }], openingBalance }`.
// Takroriy va kelajak oylar shu yerning o'zida bloklanadi (tanlovda ko'rinmaydi)
// va baribir yuzaga kelsa (eski data) qator ostida xato sifatida ko'rsatiladi.
// `errors` — tashqaridan (masalan server javobidan) qo'shimcha qator xatolari.
function OpeningDebtsEditor({ value, onChange, errors = {} }) {
  const { t } = useTranslation();
  const monthNames = t("common.monthNames", { returnObjects: true });
  const rows = useMemo(() => value?.openingDebts || [], [value]);
  const months = useMemo(() => recentMonths(), []);
  const localErrors = useMemo(() => validateOpeningRows(rows), [rows]);
  const total = openingTotal(rows);
  const somSuffix = t("student.somSuffix");

  const emit = (patch) => onChange?.({ ...value, ...patch });

  const updateRow = (index, patch) =>
    emit({ openingDebts: rows.map((r, i) => (i === index ? { ...r, ...patch } : r)) });

  const removeRow = (index) => emit({ openingDebts: rows.filter((_, i) => i !== index) });

  const addRow = () => {
    if (rows.length >= OPENING_MAX_ROWS) return;
    const used = new Set(rows.map((r) => r.month));
    const firstFree = months.find((m) => !used.has(m)) || null;
    emit({ openingDebts: [...rows, { month: firstFree, amount: "", note: "" }] });
  };

  const monthOptionsFor = (index) => {
    const own = rows[index]?.month;
    const usedByOthers = new Set(rows.filter((_, i) => i !== index).map((r) => r.month));
    const list = months.filter((m) => !usedByOthers.has(m));
    // Diapazondan tashqaridagi (juda eski) saqlangan oy ham ko'rinib tursin
    if (own && !list.includes(own)) list.push(own);
    return list.map((m) => ({ value: m, label: formatMonthName(m, monthNames) }));
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <p className="pl-1 text-xs text-slate-400 dark:text-slate-500">{t("student.openingHint")}</p>

      {rows.length === 0 ? (
        <p className="pl-1 py-1 text-sm text-slate-400 dark:text-slate-500">{t("student.openingEmptyState")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row, index) => {
            const rowErr = { ...localErrors[index], ...errors[index] };
            return (
              <div key={index} className="flex flex-col sm:flex-row sm:items-start gap-2">
                <div className="flex flex-col gap-1 w-full sm:flex-1 min-w-0">
                  <Select
                    placeholder={t("student.openingMonthUnknown")}
                    icon={<HiOutlineCalendarDays />}
                    color={rowErr.month ? "red" : "blue"}
                    value={row.month || ""}
                    onChange={(m) => updateRow(index, { month: m || null })}
                    options={monthOptionsFor(index)}
                  />
                  {rowErr.month && (
                    <span className="pl-2 text-xs text-red-500">{t(rowErr.month)}</span>
                  )}
                </div>
                <div className="flex items-start gap-2 w-full sm:flex-1 min-w-0">
                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <Input
                      inputMode="numeric"
                      placeholder="0"
                      color={rowErr.amount && row.amount !== "" ? "red" : "blue"}
                      value={formatAmount(row.amount)}
                      onChange={(e) => updateRow(index, { amount: parseAmount(e.target.value) })}
                    />
                    {rowErr.amount && row.amount !== "" && (
                      <span className="pl-2 text-xs text-red-500">{t(rowErr.amount)}</span>
                    )}
                  </div>
                  <IconButton
                    variant="ghost"
                    color="red"
                    title={t("common.delete")}
                    onClick={() => removeRow(index)}
                  >
                    <HiOutlineTrash />
                  </IconButton>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Button
        variant="ghost"
        color="blue"
        className="self-start !px-3 !min-h-8 !max-h-8"
        disabled={rows.length >= OPENING_MAX_ROWS}
        onClick={addRow}
      >
        <HiOutlinePlus className="text-sm" />
        {t("student.openingAddRow")}
      </Button>
      {rows.length >= OPENING_MAX_ROWS && (
        <span className="pl-1 text-xs text-slate-400 dark:text-slate-500">{t("student.openingTooMany")}</span>
      )}

      {rows.length > 0 && (
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-night-700 pt-2 mt-2">
          <span className="text-sm text-slate-500 dark:text-slate-400">{t("student.openingTotalLabel")}</span>
          <NumberText>
            {total.toLocaleString("uz-UZ")} {somSuffix}
          </NumberText>
        </div>
      )}

      <div className="flex flex-col gap-1 bg-slate-50 dark:bg-night-800 rounded-xl p-3 mt-1">
        <Input
          inputMode="numeric"
          variant="white"
          label={t("student.openingAdvanceLabel")}
          placeholder="0"
          value={formatAmount(value?.openingBalance)}
          onChange={(e) => emit({ openingBalance: parseAmount(e.target.value) })}
        />
      </div>
    </div>
  );
}

export default OpeningDebtsEditor;
