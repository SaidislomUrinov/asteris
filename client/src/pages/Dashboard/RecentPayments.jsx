import { useTranslation } from "react-i18next";
import { HiBanknotes } from "react-icons/hi2";
import ChartCard from "../../ui/ChartCard";
import Avatar from "../../ui/Avatar";
import NumberText from "../../ui/NumberText";
import { maskMoney } from "../../utils/moneyFormat";

// Faol filialdagi oxirgi to'lovlar (`/dashboard` → `recentPayments`, yangisi
// tepada). Ro'yxat kartochka ichida scroll bo'ladi — qator balandligi sobit.
function RecentPayments({ payments = [], hideFinance = false }) {
  const { t } = useTranslation();

  return (
    <ChartCard className="min-h-0">
      <p className="font-semibold text-slate-800 dark:text-slate-100 shrink-0">{t("dashboard.recentPayments")}</p>
      {payments.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 flex-1 min-h-24 text-slate-400 dark:text-slate-500 text-sm">
          <HiBanknotes className="text-2xl" />
          {t("dashboard.noPayments")}
        </div>
      ) : (
        <ul className="flex-1 min-h-0 overflow-y-auto max-lg:max-h-80 -mx-1 px-1">
          {payments.map((p, i) => (
            <li
              key={`${p.student._id}-${p.dateUnix}-${i}`}
              className="flex items-center gap-2.5 py-2 border-t border-slate-100 dark:border-night-700 first:border-t-0 first:pt-0"
            >
              <Avatar user={{ _id: p.student._id, name: p.student.fullName, avatar: p.student.photo }} size={32} />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                  {p.student.fullName}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500">{p.date}</span>
              </div>
              <NumberText className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                {maskMoney(p.amount, hideFinance)}
              </NumberText>
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  );
}

export default RecentPayments;
