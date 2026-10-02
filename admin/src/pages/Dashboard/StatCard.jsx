import NumberText from "../../ui/NumberText";

const COLORS = {
  blue: "bg-blue-50 text-blue-600",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  red: "bg-red-50 text-red-600",
  slate: "bg-slate-100 text-slate-600",
  violet: "bg-violet-50 text-violet-600",
};

// Ixcham statistik karta — Dashboard tepasidagi asosiy hisoblagichlar uchun.
export default function StatCard({ icon, label, value, color = "slate" }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-white">
      <div
        className={`flex items-center justify-center w-11 h-11 shrink-0 rounded-lg text-xl ${COLORS[color] || COLORS.slate}`}
      >
        {icon}
      </div>
      <div className="flex flex-col min-w-0">
        <NumberText className="text-xl leading-tight">{value}</NumberText>
        <span className="text-[12px] text-slate-400 truncate">{label}</span>
      </div>
    </div>
  );
}
