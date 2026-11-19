const COLORS = {
  orange: "bg-orange-500",
  blue: "bg-blue-500",
  emerald: "bg-emerald-500",
  slate: "bg-slate-400",
  red: "bg-red-400",
};

// Boshlanmagan / bajarib bo'lmaydigan holat: bar chiziladi, lekin to'ldirilmagan —
// chiziqli (shtrixli) track uni oddiy 0% dan ajratib turadi.
const IDLE_TRACK =
  "bg-slate-100 dark:bg-night-800 bg-[repeating-linear-gradient(135deg,transparent_0_4px,rgba(148,163,184,0.28)_4px_8px)]";

/**
 * Oddiy progress-bar — label yuqorida "value/max" ko'rinishida chiqadi.
 * @param {Object} props
 * @param {number} props.value
 * @param {number} props.max
 * @param {string} [props.label] - "17/20" o'rniga to'liq matn (masalan "O'quvchilar: 17/20")
 * @param {"orange"|"blue"|"emerald"|"slate"} [props.color]
 * @param {boolean} [props.idle] - boshlanmagan holat: shtrixli bo'sh track
 * @param {boolean} [props.light] - to'q rangli fon ustida ishlatilganda (label oq, track shaffof-oq)
 */
function ProgressBar({ value = 0, max = 0, label, color = "blue", light = false, idle = false }) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

  return (
    <div className="flex flex-col gap-1 w-full">
      {label && (
        <div
          className={`flex items-center justify-between text-xs font-medium ${light ? "text-white/80" : "text-slate-500 dark:text-slate-400"}`}
        >
          <span>{label}</span>
          <span>
            {value}/{max}
          </span>
        </div>
      )}
      <div
        className={`w-full h-1.5 rounded-full overflow-hidden ${light ? "bg-white/20 dark:bg-night-900/20" : idle ? IDLE_TRACK : "bg-slate-100 dark:bg-night-800"}`}
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
