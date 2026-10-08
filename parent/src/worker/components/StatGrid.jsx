import { KpiCard } from "./KpiCard";

// 2 ustunli statistika kartalari (Moliya / Hisobot / Oylik).
export const StatGrid = ({ items }) => (
  <div className="grid grid-cols-2 gap-2">
    {items.map((it) => (
      <KpiCard key={it.key} label={it.label} value={it.value} tone={it.tone} />
    ))}
  </div>
);
