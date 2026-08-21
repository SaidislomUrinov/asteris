const COLORS = {
  orange: "bg-orange-500",
  blue: "bg-blue-500",
  emerald: "bg-emerald-500",
  slate: "bg-slate-400",
};

/**
 * Oddiy progress-bar — label yuqorida "value/max" ko'rinishida chiqadi.
 * @param {Object} props
 * @param {number} props.value
 * @param {number} props.max
 * @param {string} [props.label] - "17/20" o'rniga to'liq matn (masalan "O'quvchilar: 17/20")
 * @param {"orange"|"blue"|"emerald"|"slate"} [props.color]
 * @param {boolean} [props.light] - to'q rangli fon ustida ishlatilganda (label oq, track shaffof-oq)
 */
function ProgressBar({ value = 0, max = 0, label, color = "blue", light = false }) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

  return (
    <div className="flex flex-col gap-1 w-full">
      {label && (
        <div
          className={`flex items-center justify-between text-xs font-medium ${light ? "text-white/80" : "text-slate-500"}`}
        >
          <span>{label}</span>
          <span>
            {value}/{max}
          </span>
        </div>
      )}
      <div
        className={`w-full h-1.5 rounded-full overflow-hidden ${light ? "bg-white/20" : "bg-slate-100"}`}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${COLORS[color] || COLORS.blue}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export default ProgressBar;
