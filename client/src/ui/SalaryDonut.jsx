import { useTranslation } from "react-i18next";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { maskMoney } from "../utils/moneyFormat";

const NET_COLOR = "#10b981"; // emerald-500 — hisoblangan + bonus
const DEDUCT_COLOR = "#f43f5e"; // rose-500 — avans + oldindan olingan + jarima

/**
 * Oylik tarkibi donuti — "hisoblangan + bonus" va "avans + oldindan olingan +
 * jarima" nisbati. TeacherHome va StaffProfile bir xil komponentdan
 * foydalanadi (PaymentDonut bilan bir xil vizual til, boshqa ma'lumot).
 *
 * @param {Object} props
 * @param {number} [props.base]
 * @param {number} [props.bonus]
 * @param {number} [props.advance]
 * @param {number} [props.withdrawal]
 * @param {number} [props.payout]
 * @param {number} [props.penalty]
 * @param {number} [props.final]
 */
function SalaryDonut({ base = 0, bonus = 0, advance = 0, withdrawal = 0, payout = 0, penalty = 0, final = 0, hidden = false }) {
  const { t } = useTranslation();
  const net = base + bonus;
  const deducted = advance + withdrawal + payout + penalty;
  const total = net + deducted;

  const data =
    total > 0
      ? [
          { key: "net", value: net },
          { key: "deducted", value: deducted },
        ]
      : [{ key: "net", value: 1 }];

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div className="relative w-full max-w-[200px] aspect-square">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="key"
              innerRadius="72%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              paddingAngle={total > 0 && net > 0 && deducted > 0 ? 3 : 0}
              cornerRadius={6}
              stroke="none"
            >
              {data.map((entry) => (
                <Cell
                  key={entry.key}
                  fill={entry.key === "net" ? NET_COLOR : DEDUCT_COLOR}
                  opacity={total === 0 ? 0.15 : 1}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-4">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {t("salary.final")}
          </span>
          <span className="text-xl font-space font-bold text-slate-900 dark:text-slate-100 truncate">
            {maskMoney(final, hidden)}
          </span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">{t("student.somSuffix")}</span>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: NET_COLOR }} />
          <span className="text-slate-500 dark:text-slate-400">
            {t("salary.base")} + {t("salary.bonus")}
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: DEDUCT_COLOR }} />
          <span className="text-slate-500 dark:text-slate-400">{t("salary.deductions")}</span>
        </span>
      </div>
    </div>
  );
}

export default SalaryDonut;
