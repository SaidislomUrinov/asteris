/**
 * "IND" — individual o'quvchi / individual guruh belgisi
 * (docs/API_CONTRACT_individual_students.md §4). Kichik, accent rangli chip;
 * `title` berilsa native tooltip sifatida ko'rinadi.
 *
 * @param {Object} props
 * @param {string} [props.title]
 * @param {string} [props.className]
 */
function IndBadge({ title, className = "" }) {
  return (
    <span
      title={title}
      aria-label={title}
      className={`inline-flex items-center justify-center shrink-0 whitespace-nowrap align-middle px-1.5 h-[18px] rounded-md text-[10px] font-bold tracking-wider leading-none select-none cursor-help bg-fuchsia-50 dark:bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 ring-1 ring-inset ring-fuchsia-200 dark:ring-fuchsia-400/30 ${className}`}
    >
      IND
    </span>
  );
}

export default IndBadge;
