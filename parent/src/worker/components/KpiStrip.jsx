import { useTranslation } from "react-i18next";
import { money } from "../../utils/format";
import { compactMoney } from "../utils";
import { KpiCard } from "./KpiCard";

// KPI rangi kalit bo'yicha (server faqat raqam beradi, §3.2).
const TONE = { attendanceRate: "ok", debtTotal: "bad", debtorsCount: "bad", gradesPending: "warn" };
const PERCENT = ["attendanceRate"];

const fmt = (k) => {
  // null — hisoblab bo'lmadi (masalan bugun hali davomat yo'q).
  if (k.value == null) return "—";
  if (k.money) return compactMoney(k.value);
  if (k.percent || PERCENT.includes(k.key)) return `${Math.round(k.value)}%`;
  return money(k.value);
};

export const KpiStrip = ({ kpis }) => {
  const { t } = useTranslation();
  if (!kpis?.length) return null;
  return (
    <div className="grid grid-cols-3 gap-2">
      {kpis.slice(0, 3).map((k) => (
        <KpiCard
          key={k.key}
          label={t(`worker.kpi.${k.key}`, { defaultValue: k.key })}
          value={fmt(k)}
          tone={k.value > 0 ? TONE[k.key] : undefined}
        />
      ))}
    </div>
  );
};
