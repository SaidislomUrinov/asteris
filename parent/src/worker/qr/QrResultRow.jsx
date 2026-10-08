import { useTranslation } from "react-i18next";
import { Pill } from "../../components/Card";
import { tashkentHHmm } from "../utils";

const TONE = { present: "ok", late: "warn", duplicate: "mut", error: "bad" };

// Sessiyadagi bitta skan natijasi: ism (xatoda — xato matni), ostida fan,
// o'ngda holat pill'i va vaqt (JetBrains Mono).
export const QrResultRow = ({ item }) => {
  const { t } = useTranslation();
  const time = tashkentHHmm(new Date(item.at));
  const sub = item.kind !== "error" ? item.subject : "";
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 min-h-14">
      <div className="min-w-0 flex-1">
        <div className="font-bold text-[14px] leading-tight truncate">{item.name || "—"}</div>
        {sub && <div className="text-[12.5px] text-hint truncate mt-0.5">{sub}</div>}
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1">
        <Pill tone={TONE[item.kind]}>{t(`worker.qr.status.${item.kind}`)}</Pill>
        <span className="tabular text-[11.5px] font-bold text-hint leading-none">{time}</span>
      </div>
    </div>
  );
};
