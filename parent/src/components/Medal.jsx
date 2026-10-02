import { useId } from "react";

// Oltin / kumush / bronza — disk gradienti, chekka halqa va lenta ranglari.
const MEDAL_PALETTE = {
  1: { hi: "#FFF3B0", mid: "#F5C542", lo: "#B7791F", rim: "#8A5A0B", ribbonA: "#2563EB", ribbonB: "#1D4ED8", glow: "rgba(245,197,66,0.55)" },
  2: { hi: "#FFFFFF", mid: "#CBD5E1", lo: "#7C8BA1", rim: "#55637A", ribbonA: "#DC2626", ribbonB: "#B91C1C", glow: "rgba(148,163,184,0.5)" },
  3: { hi: "#FFD9B0", mid: "#D98B4B", lo: "#8C4A1C", rim: "#6B3510", ribbonA: "#16A34A", ribbonB: "#15803D", glow: "rgba(217,139,75,0.5)" },
};

/**
 * Guruh reytingidagi 1/2/3-o'rin uchun SVG medal (lenta + gradient disk +
 * raqam). `position` 1–3 dan tashqarida bo'lsa hech narsa chizilmaydi.
 * Animatsiya: kirishda "pop", doimiy yaltiroq nur, 1-o'rinda nur pulsatsiyasi
 * (prefers-reduced-motion'da o'chadi — index.css).
 *
 * @param {Object} props
 * @param {number|null|undefined} props.position
 * @param {number} [props.size=22] — disk diametri (px); umumiy balandlik ~1.45×
 * @param {boolean} [props.animated=true]
 * @param {string} [props.label] — aria-label (i18n matn)
 */
export const Medal = ({ position, size = 22, animated = true, label, className = "" }) => {
  const uid = useId().replace(/:/g, "");
  const p = MEDAL_PALETTE[position];
  if (!p) return null;

  return (
    <span
      role="img"
      aria-label={label || String(position)}
      title={label}
      className={`relative inline-flex shrink-0 ${animated ? "medal-pop" : ""} ${className}`}
      style={{ width: size, height: size * 1.45 }}
    >
      {position === 1 && animated && (
        <span
          aria-hidden
          className="medal-glow absolute rounded-full blur-[6px]"
          style={{ width: size * 1.1, height: size * 1.1, left: -size * 0.05, bottom: -size * 0.05, background: p.glow }}
        />
      )}
      <svg viewBox="0 0 40 58" width={size} height={size * 1.45} className={`relative drop-shadow-[0_1px_1.5px_rgba(15,23,42,0.28)] ${animated ? "medal-sway" : ""}`}
      >
        <defs>
          <radialGradient id={`d${uid}`} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor={p.hi} />
            <stop offset="55%" stopColor={p.mid} />
            <stop offset="100%" stopColor={p.lo} />
          </radialGradient>
          <linearGradient id={`r${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={p.mid} />
            <stop offset="100%" stopColor={p.lo} />
          </linearGradient>
          <clipPath id={`c${uid}`}>
            <circle cx="20" cy="38" r="17" />
          </clipPath>
        </defs>
        {/* Lenta — ikki tasma V shaklida */}
        <path d="M6 0h10l8 22h-10z" fill={p.ribbonB} />
        <path d="M34 0H24l-8 22h10z" fill={p.ribbonA} />
        <path d="M11 0h3l6 17-2 4z" fill="#fff" opacity="0.28" />
        {/* Disk */}
        <circle cx="20" cy="38" r="18.5" fill={p.rim} />
        <circle cx="20" cy="38" r="17" fill={`url(#d${uid})`} />
        <circle cx="20" cy="38" r="12.5" fill="none" stroke={`url(#r${uid})`} strokeWidth="1.6" opacity="0.9" />
        <text
          x="20"
          y="38"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="17"
          fontWeight="800"
          fill={p.rim}
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {position}
        </text>
        {/* Yaltiroq nur — disk ichida chapdan o'ngga o'tadi */}
        <g clipPath={`url(#c${uid})`}>
          <rect
            x="14"
            y="18"
            width="7"
            height="42"
            fill="#fff"
            opacity="0.55"
            className={animated ? "medal-shine" : ""}
            style={{ transformBox: "fill-box", transformOrigin: "center", transform: animated ? undefined : "translateX(-34px)" }}
          />
        </g>
      </svg>
    </span>
  );
};

