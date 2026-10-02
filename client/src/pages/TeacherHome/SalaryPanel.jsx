import { useTranslation } from "react-i18next";
import { HiBanknotes } from "react-icons/hi2";
import NumberText from "../../ui/NumberText";
import SalaryDonut from "../../ui/SalaryDonut";
import LedgerRow from "../../ui/LedgerRow";
import MonthNav from "../../ui/MonthNav";
import HiddenFinancePanel from "../../components/HiddenFinancePanel";

const money = (v) => `${(v || 0).toLocaleString("uz-UZ")}`;

/**
 * "Ish haqi" paneli: oy tanlovi, donut, hisob qatorlari va yakuniy qoldiq
 * (eng kuchli urg'u). Tranzaksiyalar tarixi alohida kartada
 * (`TransactionsCard`). Moliya yashirilgan bo'lsa
 * summalar umuman chizilmaydi — o'rniga `HiddenFinancePanel`.
 *
 * @param {Object} props
 * @param {Object|null} props.salary - API `salary`
 * @param {boolean} props.loading - boshqa oy yuklanmoqda
 * @param {boolean} props.hidden - `useHideFinance`
 * @param {string} props.month - "YYYY-MM"
 * @param {string} props.monthLabel
 * @param {string} props.maxMonth
 * @param {(month: string) => void} props.onMonthChange
 */
function SalaryPanel({ salary, loading, hidden, month, monthLabel, maxMonth, onMonthChange }) {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-4 p-5 rounded-xl border border-slate-200 bg-white">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600">
            <HiBanknotes aria-hidden="true" />
          </span>
          <h2 className="font-semibold text-slate-800">{t("salary.title")}</h2>
        </div>
        <MonthNav month={month} label={monthLabel} onChange={onMonthChange} max={maxMonth} />
      </header>

      {loading ? (
        <div className="flex flex-col gap-3 animate-pulse" aria-busy="true">
          <div className="mx-auto w-40 h-40 rounded-full border-[14px] border-slate-100" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-5 rounded-md bg-slate-100" />
          ))}
        </div>
      ) : hidden ? (
        <HiddenFinancePanel className="min-h-48" />
      ) : !salary ? (
        <p className="text-sm text-slate-400 py-6 text-center">{t("teacherHome.noSalary")}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-[240px_1fr] lg:grid-cols-1 gap-4 sm:gap-6 lg:gap-4 items-center">
          <div className="flex justify-center">
            <div className="w-full">
              <SalaryDonut
                base={salary.base}
                bonus={salary.bonus}
                advance={salary.advance}
                withdrawal={salary.withdrawal}
                penalty={salary.penalty}
                final={salary.final}
              />
            </div>
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex flex-col divide-y divide-slate-100">
              <LedgerRow label={t("salary.base")} value={salary.base} />
              <LedgerRow label={t("salary.bonus")} value={salary.bonus} tone="positive" />
              <LedgerRow label={t("salary.advance")} value={salary.advance} tone="negative" />
              <LedgerRow label={t("salary.withdrawal")} value={salary.withdrawal} tone="negative" />
              <LedgerRow label={t("salary.penalty")} value={salary.penalty} tone="negative" />
            </div>
            {/* Yakuniy qoldiq — eng kuchli urg'u; avans oylikdan oshib ketgan
                bo'lsa (manfiy) yashil emas, qizil ohangda. */}
            <div
              className={`flex items-center justify-between gap-3 mt-2 px-3 py-3 rounded-xl ${
                salary.final < 0 ? "bg-rose-50" : "bg-emerald-50"
              }`}
            >
              <span className={`text-sm font-semibold ${salary.final < 0 ? "text-rose-800" : "text-emerald-800"}`}>
                {t("salary.final")}
              </span>
              <span className="flex items-baseline gap-1 min-w-0">
                <NumberText
                  className={`!text-lg truncate ${salary.final < 0 ? "!text-rose-600" : "!text-emerald-700"}`}
                >
                  {money(salary.final)}
                </NumberText>
                <span className="text-xs text-slate-400 shrink-0">{t("student.somSuffix")}</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default SalaryPanel;
