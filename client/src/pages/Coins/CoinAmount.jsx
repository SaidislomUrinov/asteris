import CoinIcon from "../../ui/CoinIcon";

/**
 * Tanga miqdori — ikonka + raqam (WECOIN hamma joyda bir xil ko'rinsin).
 *
 * @param {Object} props
 * @param {number} props.value
 * @param {number} [props.size=16] - ikonka o'lchami
 * @param {string} [props.className]
 */
function CoinAmount({ value, size = 16, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1 font-bold tabular-nums text-amber-600 dark:text-amber-400 ${className}`}>
      <CoinIcon size={size} />
      {Number(value || 0).toLocaleString("ru-RU")}
    </span>
  );
}

export default CoinAmount;
