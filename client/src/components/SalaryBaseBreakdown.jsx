import { useTranslation } from "react-i18next";
import NumberText from "../ui/NumberText";
import { maskMoney } from "../utils/moneyFormat";

/**
 * "Hisoblangan oylik" va uning tarkibi: asosiy qism (fiks yoki guruhlardan %)
 * + individual o'quvchilar + alohida foizli o'quvchilar
 * (docs/API_CONTRACT_individual_students.md, API_CONTRACT_entry_teacher_percent.md).
 * Server `base` ga ikkalasini allaqachon qo'shgan — bu yerda faqat tarkibi.
 * Individual/alohida foiz bo'lmasa oddiy bitta qator (avvalgi LedgerRow kabi).
 *
 * @param {Object} props
 * @param {Object} props.salary - salaryService.detail javobi
 * @param {boolean} [props.hidden] - useHideFinance
 * @param {boolean} [props.onlyIfExtras] - tarkib bo'lmasa umuman chizilmaydi
 * @param {string} [props.className]
 */
function SalaryBaseBreakdown({ salary, hidden = false, onlyIfExtras = false, className = "" }) {
  const { t } = useTranslation();
  if (!salary) return null;

  const individual = salary.individual?.items?.length ? salary.individual : null;
  const custom = salary.customPercent?.items?.length ? salary.customPercent : null;
  const hasExtras = !!(individual || custom);
  if (onlyIfExtras && !hasExtras) return null;

  const base = salary.base || 0;
  const mainBase = salary.mainBase ?? base - (individual?.amount || 0) - (custom?.amount || 0);
  const mainLabel =
    salary.salaryType === "fixed"
      ? t("salary.breakdown.mainFixed")
      : salary.salaryType === "percentage"
        ? t("salary.breakdown.mainPercent", { p: salary.percent ?? salary.staff?.salaryValue ?? 0 })
        : t("salary.breakdown.main");

  const parts = [
    { key: "main", label: mainLabel, amount: mainBase, items: [] },
    individual && {
      key: "individual",
      label: t("salary.breakdown.individual", { count: individual.items.length }),
      amount: individual.amount,
      items: individual.items.map((it) => ({
        key: it.groupId,
        text: `${it.studentName} · ${it.percent}%`,
        amount: it.amount,
      })),
    },
    custom && {
      key: "custom",
      label: t("salary.breakdown.custom", { count: custom.items.length }),
      amount: custom.amount,
      items: custom.items.map((it) => ({
        key: it.groupEntryId || `${it.groupId}-${it.studentName}`,
        text: [it.studentName, it.groupLabel, `${it.percent}%`].filter(Boolean).join(" · "),
        amount: it.amount,
      })),
    },
  ].filter(Boolean);

  return (
    <div className={`flex flex-col py-2.5 text-sm ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-slate-500 dark:text-slate-400">{t("salary.base")}</span>
        <NumberText className="text-slate-800 dark:text-slate-100 text-[15px]">{maskMoney(base, hidden)}</NumberText>
      </div>
      {hasExtras && (
        <ul className="flex flex-col gap-2 mt-2 ml-0.5 pl-3 border-l-2 border-slate-100 dark:border-night-700">
          {parts.map((part) => (
            <li key={part.key} className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center justify-between gap-3 min-w-0">
                <span className="truncate text-[13px] text-slate-600 dark:text-slate-300">{part.label}</span>
                <NumberText className="shrink-0 text-[13px] text-slate-700 dark:text-slate-200">
                  {maskMoney(part.amount || 0, hidden)}
                </NumberText>
              </div>
              {part.items.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-3 pl-2 text-xs text-slate-400 dark:text-slate-500 min-w-0"
                >
                  <span className="truncate">{item.text}</span>
                  <NumberText className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                    {maskMoney(item.amount || 0, hidden)}
                  </NumberText>
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default SalaryBaseBreakdown;
