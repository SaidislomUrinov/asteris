/**
 * "{p}%" — o'quvchi a'zoligining "Alohida foiz"i belgisi
 * (docs/API_CONTRACT_entry_teacher_percent.md §4). Kichik, violet chip;
 * `title` berilsa native tooltip sifatida ko'rinadi. IndBadge bilan bir xil o'lcham.
 *
 * @param {Object} props
 * @param {number} props.percent
 * @param {string} [props.title]
 * @param {string} [props.className]
 */
function PercentChip({ percent, title, className = "" }) {
  return (
    <span
      title={title}
      aria-label={title}
      className={`inline-flex items-center justify-center shrink-0 whitespace-nowrap align-middle px-1.5 h-[18px] rounded-md text-[10px] font-bold tracking-wide leading-none select-none cursor-help bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 ring-1 ring-inset ring-violet-200 dark:ring-violet-400/30 ${className}`}
    >
      {percent}%
    </span>
  );
}

export default PercentChip;
