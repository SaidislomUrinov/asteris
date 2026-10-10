import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiOutlineChevronRight } from "react-icons/hi2";
import Chip from "../../ui/Chip";
import OpeningDebtsEditor from "./OpeningDebtsEditor";
import { openingTotal } from "./openingDebts.util";

/**
 * "Oldingi qarzdorlik" yig'iluvchi bo'limi (API_CONTRACT_opening_debts.md §3.1)
 * — StudentDialog va IndividualDialog uchun umumiy.
 *
 * @param {Object} props
 * @param {Object} props.value - EMPTY_OPENING shaklidagi qiymat
 * @param {(v: Object) => void} props.onChange
 */
function OpeningDebtsSection({ value, onChange }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const sum = openingTotal(value.openingDebts);

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between gap-2 py-2 cursor-pointer text-left"
      >
        <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800 dark:text-slate-100">
          <HiOutlineChevronRight
            className={`text-slate-400 dark:text-slate-500 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
          />
          {t("student.openingSectionTitle")}
        </span>
        {sum > 0 && (
          <Chip
            color="orange"
            className="normal-case"
            value={`${sum.toLocaleString("uz-UZ")} ${t("student.somSuffix")}`}
          />
        )}
      </button>
      {open && (
        <div
          className="border-t border-slate-100 dark:border-night-700 pt-3 mt-1"
          onKeyDown={(e) => e.stopPropagation()}
        >
          <OpeningDebtsEditor value={value} onChange={onChange} />
        </div>
      )}
    </div>
  );
}

export default OpeningDebtsSection;
