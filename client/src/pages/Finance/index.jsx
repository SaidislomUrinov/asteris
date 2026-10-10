import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { HiBanknotes, HiClipboardDocumentList } from "react-icons/hi2";
import Chip from "../../ui/Chip";
import NumberText from "../../ui/NumberText";
import Loading from "../../ui/Loading";
import SalaryDonut from "../../ui/SalaryDonut";
import LedgerRow from "../../ui/LedgerRow";
import MonthNav from "../../ui/MonthNav";
import useHideFinance from "../../hooks/useHideFinance";
import { api } from "../../utils/fetching";
import { errorMsg } from "../../utils/alert";
import { maskMoney } from "../../utils/moneyFormat";
import IndividualSalaryRows from "../../components/IndividualSalaryRows";

const monthOf = (str) => Number(str.slice(5, 7)) - 1;
const yearOf = (str) => Number(str.slice(0, 4));
const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const TABS = [
  { key: "salary", labelKey: "finance.tabSalary", icon: HiBanknotes },
  { key: "transactions", labelKey: "finance.tabTransactions", icon: HiClipboardDocumentList },
];

const txTypeColor = { advance: "blue", withdrawal: "orange", bonus: "emerald", penalty: "red" };

// Hodimning shaxsiy "Moliya" sahifasi — StaffProfile'dan ajratilgan
// ("Oyligim"/"Tranzaksiyalarim"), o'zgarishsiz ko'chirilgan (keyingi
// bosqichda alohida qayta dizayn qilinadi).
function Finance() {
  const { t } = useTranslation();
  const user = useSelector((e) => e.user);
  const [tab, setTab] = useState("salary");
  const [hideFinance] = useHideFinance();
  const money = (v) => maskMoney(v, hideFinance);

  const [month, setMonth] = useState(currentMonth());
  const [salary, setSalary] = useState(null);
  const [salaryLoading, setSalaryLoading] = useState(true);

  const fetchSalary = useCallback(async () => {
    try {
      setSalaryLoading(true);
      const res = await api.get(`/salaries/${user._id}`, { params: { month } });
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setSalary(data);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setSalaryLoading(false);
    }
  }, [user._id, month]);

  useEffect(() => {
    const id = setTimeout(fetchSalary, 0);
    return () => clearTimeout(id);
  }, [fetchSalary]);

  const typeChip = () => {
    if (salary?.salaryType === "fixed") return <Chip value={t("salary.typeFixed")} color="blue" />;
    if (salary?.salaryType === "percentage")
      return <Chip value={`${salary.percent ?? salary.staff?.salaryValue ?? 0}%`} color="violet" />;
    return <Chip value="—" color="slate" />;
  };

  const monthNames = t("common.monthNames", { returnObjects: true });
  const monthLabel = `${monthNames[monthOf(month)]} ${yearOf(month)}`;

  return (
    <div className="flex flex-col w-full h-full gap-4">
      <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-night-800 w-fit overflow-x-auto max-w-full">
        {TABS.map((tb) => {
          const Icon = tb.icon;
          const active = tab === tb.key;
          return (
            <button
              key={tb.key}
              type="button"
              onClick={() => setTab(tb.key)}
              className={`flex items-center gap-2 px-3.5 h-9 rounded-lg text-sm font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                active ? "bg-white dark:bg-night-900 text-slate-900 dark:text-slate-100 shadow-sm dark:shadow-none" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              <Icon className="text-base" />
              {t(tb.labelKey)}
            </button>
          );
        })}
      </div>

      {tab === "salary" && (
        <div className="flex flex-col gap-1 p-5 sm:p-6 rounded-2xl border border-slate-200/70 dark:border-night-700/70 bg-white dark:bg-night-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none">
          <div className="flex items-center justify-between gap-2 flex-wrap pb-4">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <HiBanknotes className="text-base" />
              </span>
              <p className="font-semibold text-slate-800 dark:text-slate-100">{t("salary.title")}</p>
              {typeChip()}
            </div>
            <MonthNav month={month} label={monthLabel} onChange={setMonth} max={currentMonth()} />
          </div>

          {salaryLoading ? (
            <Loading height="20vh" />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[220px_1px_1fr] gap-6 items-start">
              <div className="flex justify-center lg:justify-start pt-2">
                <SalaryDonut
                  base={salary?.base}
                  bonus={salary?.bonus}
                  advance={salary?.advance}
                  withdrawal={salary?.withdrawal}
                  penalty={salary?.penalty}
                  final={salary?.final}
                  hidden={hideFinance}
                />
              </div>

              <div className="hidden lg:block w-px bg-slate-100 dark:bg-night-800 self-stretch" />

              <div className="flex flex-col divide-y divide-slate-100 dark:divide-night-700 pt-1">
                <LedgerRow label={t("salary.base")} value={salary?.base} hidden={hideFinance} />
                <IndividualSalaryRows individual={salary?.individual} customPercent={salary?.customPercent} hidden={hideFinance} />
                <LedgerRow
                  label={t("salary.bonus")}
                  value={salary?.bonus}
                  tone="positive"
                  hidden={hideFinance}
                />
                <LedgerRow
                  label={t("salary.advance")}
                  value={salary?.advance}
                  tone="negative"
                  hidden={hideFinance}
                />
                <LedgerRow
                  label={t("salary.withdrawal")}
                  value={salary?.withdrawal}
                  tone="negative"
                  hidden={hideFinance}
                />
                <LedgerRow
                  label={t("salary.penalty")}
                  value={salary?.penalty}
                  tone="negative"
                  hidden={hideFinance}
                />
                <div className="flex items-center justify-between pt-3 mt-1 border-t-2 border-slate-100 dark:border-night-700">
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{t("salary.final")}</span>
                  <NumberText
                    className={`!text-lg ${salary?.final < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}
                  >
                    {money(salary?.final)}
                  </NumberText>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "transactions" && (
        <div className="flex flex-col gap-1 p-5 sm:p-6 rounded-2xl border border-slate-200/70 dark:border-night-700/70 bg-white dark:bg-night-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none">
          <div className="flex items-center justify-between gap-2 flex-wrap pb-4">
            <p className="font-semibold text-slate-800 dark:text-slate-100">{t("finance.tabTransactions")}</p>
            <MonthNav month={month} label={monthLabel} onChange={setMonth} max={currentMonth()} />
          </div>

          {salaryLoading ? (
            <Loading height="20vh" />
          ) : !salary?.transactions?.length ? (
            <div className="flex flex-col items-center justify-center gap-1.5 py-8 text-center">
              <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-50 dark:bg-night-800 text-lg text-slate-300 dark:text-slate-600">
                <HiClipboardDocumentList />
              </span>
              <p className="text-xs text-slate-400 dark:text-slate-500">{t("salary.noTransactions")}</p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-slate-100 dark:divide-night-700">
              {salary.transactions.map((tx) => (
                <div
                  key={tx._id}
                  className={`flex items-center justify-between gap-2 py-2.5 ${
                    tx.status !== "active" ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Chip
                      value={t(`salary.txType.${tx.type}`)}
                      color={txTypeColor[tx.type] || "slate"}
                      variant="ghost"
                    />
                    <div className="flex flex-col min-w-0">
                      <span
                        className={`font-semibold text-sm ${
                          tx.status === "active" ? "text-slate-800 dark:text-slate-100" : "text-slate-400 dark:text-slate-500 line-through"
                        }`}
                      >
                        {money(tx.amount)} {t("student.somSuffix")}
                      </span>
                      {tx.note && <span className="text-xs text-slate-400 dark:text-slate-500 truncate">{tx.note}</span>}
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">{tx.date}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Finance;
