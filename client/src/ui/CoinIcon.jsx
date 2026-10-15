import { useId } from "react";

/**
 * WECOIN tangasi — oltin doira, ichida "W". Ikonka kutubxonasida tanga yo'q,
 * shuning uchun kichik SVG (parent/src/components/CoinIcon.jsx bilan bir xil).
 * `animated` — yutuq nishonlari kabi: kirishda pop, vaqti-vaqti bilan aylanish
 * va yaltiroq nur (index.css `coin-*`, prefers-reduced-motion'da o'chadi).
 * Faqat ko'zga ko'rinadigan "bosh" tangalarda yoqiladi, mayda inline'da emas.
 *
 * @param {Object} props
 * @param {number} [props.size=16]
 * @param {boolean} [props.animated=false]
 * @param {number} [props.delay=0] - pop kechikishi (s)
 * @param {boolean} [props.muted=false] - kulrang
 * @param {string} [props.className]
 */
function CoinIcon({ size = 16, animated = false, delay = 0, muted = false, className = "" }) {
  const uid = useId().replace(/:/g, "");
  const svg = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={`shrink-0 overflow-visible ${animated ? "coin-flip" : ""} ${muted ? "grayscale opacity-60" : ""} ${animated ? "" : className}`}
      style={animated ? { filter: "drop-shadow(0 1.5px 2px rgba(180,83,9,0.35))" } : undefined}
    >
      <defs>
        <linearGradient id={`g${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FDE68A" />
          <stop offset="0.5" stopColor="#F59E0B" />
          <stop offset="1" stopColor="#B45309" />
        </linearGradient>
        <clipPath id={`c${uid}`}>
          <circle cx="16" cy="16" r="15" />
        </clipPath>
      </defs>
      <circle cx="16" cy="16" r="15" fill={`url(#g${uid})`} />
      <circle cx="16" cy="16" r="11.5" fill="none" stroke="#FEF3C7" strokeOpacity="0.7" strokeWidth="1.5" />
      <path
        d="M9.5 11.5 L12 21 L14.4 14.6 L16 19 L17.6 14.6 L20 21 L22.5 11.5"
        fill="none"
        stroke="#FFFBEB"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {animated && (
        <g clipPath={`url(#c${uid})`}>
          {/* Harakatlanuvchi yaltiroq nur (BadgeIcon `badge-shine` bilan bir xil g'oya) */}
          <rect x="13" y="-4" width="6" height="40" fill="#fff" opacity="0.55" className="coin-shine" />
        </g>
      )}
    </svg>
  );
  if (!animated) return svg;
  // Kirishda pop (o'ram span'da — svg'dagi aylanish animatsiyasi bilan to'qnashmasin).
  return (
    <span
      className={`coin-pop inline-flex shrink-0 [perspective:200px] ${className}`}
      style={{ width: size, height: size, animationDelay: delay ? `${delay}s` : undefined }}
    >
      {svg}
    </span>
  );
}

export default CoinIcon;
