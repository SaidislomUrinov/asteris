import { useTranslation } from "react-i18next";
import NumberText from "../ui/NumberText";
import { maskMoney } from "../utils/moneyFormat";

/**
 * O'qituvchi oyligidagi qo'shimcha foiz qismlari:
 * - "Individual o'quvchilar" (docs/API_CONTRACT_individual_students.md §2 —
 *   `computeStaffMonth.individual`);
 * - "Alohida foizli o'quvchilar" (docs/API_CONTRACT_entry_teacher_percent.md §3 —
 *   `computeStaffMonth.customPercent`).
 * Summalar allaqachon `base` ichida — bu yerda faqat tarkibi ko'rsatiladi.
 * Bo'sh qism chizilmaydi. Har qism alohida blok (ota `divide-y` ajratgichi
 * ikkalasiga ham tushadi).
 *
 * @param {Object} props
 * @param {{amount: number, items?: Array<{groupId: string, studentName: string, percent: number, amount: number}>}|null} [props.individual]
 * @param {{amount: number, items?: Array<{groupEntryId: string, studentName: string, groupLabel?: string, percent: number, amount: number}>}|null} [props.customPercent]
 * @param {boolean} [props.hidden] - useHideFinance
 * @param {string} [props.className]
 */
function IndividualSalaryRows({ individual, customPercent, hidden = false, className = "" }) {
  const { t } = useTranslation();

  const blocks = [
    {
      key: "individual",
      label: t("individual.salaryRow"),
      data: individual,
      itemKey: (item) => item.groupId,
      itemText: (item) => `${item.studentName} · ${item.percent}%`,
    },
    {
      key: "customPercent",
      label: t("entryPercent.salaryRows"),
      data: customPercent,
      itemKey: (item) => item.groupEntryId || `${item.groupId}-${item.studentName}`,
      itemText: (item) =>
        [item.studentName, item.groupLabel, `${item.percent}%`].filter(Boolean).join(" · "),
    },
  ].filter(({ data }) => data && (data.amount > 0 || (data.items || []).length > 0));

  if (blocks.length === 0) return null;

  return (
    <>
      {blocks.map((block) => {
        const items = block.data.items || [];
        return (
          <div key={block.key} className={`flex flex-col py-2.5 text-sm ${className}`}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-600 dark:text-slate-300">{block.label}</span>
              <NumberText className="text-slate-800 dark:text-slate-100 text-[15px]">
                {maskMoney(block.data.amount || 0, hidden)}
              </NumberText>
            </div>
            {items.length > 0 && (
              <ul className="flex flex-col gap-1 mt-2 ml-0.5 pl-3 border-l-2 border-slate-100 dark:border-night-700">
                {items.map((item) => (
                  <li
                    key={block.itemKey(item)}
                    className="flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 min-w-0"
                  >
                    <span className="truncate">{block.itemText(item)}</span>
                    <NumberText className="shrink-0 text-xs text-slate-600 dark:text-slate-300">
                      {maskMoney(item.amount || 0, hidden)}
                    </NumberText>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </>
  );
}

export default IndividualSalaryRows;
