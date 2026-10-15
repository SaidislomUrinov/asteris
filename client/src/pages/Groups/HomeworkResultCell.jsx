import { RESULT_BY_KEY } from "./homeworkResults";

/**
 * Uyga vazifa natijasi katagi — `AttendanceCheckbox` ning "singlisi", lekin
 * DUMALOQ va boshqa palitrada (homeworkResults.js), toki davomat va vazifa
 * matritsalari bir-biri bilan chalkashmasin.
 *
 * @param {Object} props
 * @param {"done"|"partial"|"missed"|null} props.status
 * @param {boolean} [props.future] - vazifa kuni hali kelmagan (bosilmaydi)
 * @param {boolean} [props.disabled] - ruxsat yo'q
 * @param {string} [props.size] - o'lcham klassi (default `size-8`)
 * @param {string} props.title
 * @param {(e: MouseEvent) => void} props.onClick
 * @param {string} [props.className]
 * @param {boolean} [props.static] - faqat belgi (span) — boshqa tugma ichida
 *   ishlatish uchun (ichma-ich `<button>` bo'lmasin)
 */
function HomeworkResultCell({ status, future, disabled, size = "size-8", title, onClick, className = "", static: isStatic = false }) {
  const tone = status ? RESULT_BY_KEY[status] : null;
  const Icon = tone?.icon;
  const locked = disabled || future;

  const look = tone
    ? tone.cell
    : future
      ? "bg-slate-50 dark:bg-night-800 ring-slate-200/70 dark:ring-night-700/70"
      : "bg-white dark:bg-night-900 ring-slate-200 dark:ring-night-600";

  if (isStatic) {
    return (
      <span className={`flex items-center justify-center shrink-0 ${size} rounded-full ring-1 ring-inset text-base ${className} ${look}`}>
        {Icon ? <Icon className="shrink-0" /> : null}
      </span>
    );
  }

  return (
    <button
      type="button"
      title={title}
      disabled={locked}
      onClick={onClick}
      className={`flex items-center justify-center shrink-0 ${size} rounded-full ring-1 ring-inset text-base transition-all duration-150 ${className} ${look} ${
        locked ? "cursor-default" : "cursor-pointer hover:ring-2 active:scale-90"
      }`}
    >
      {Icon ? <Icon className="shrink-0" /> : null}
    </button>
  );
}

export default HomeworkResultCell;
