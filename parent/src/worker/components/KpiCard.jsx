import { cn } from "../../utils/cn";

const TONES = { ok: "text-ok", bad: "text-bad", warn: "text-warn" };

// Bitta KPI: kichik yorliq + JetBrains Mono qiymat.
export const KpiCard = ({ label, value, tone }) => (
  <div className="bg-card rounded-2xl px-3 py-2.5 min-w-0 border border-line/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
    <div className="text-[11px] font-bold text-hint truncate">{label}</div>
    <div className={cn("tabular font-bold text-[15px] min-[380px]:text-[17px] leading-snug truncate", TONES[tone])}>{value}</div>
  </div>
);
