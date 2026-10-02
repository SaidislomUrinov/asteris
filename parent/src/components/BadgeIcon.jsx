import { useId } from "react";
import { BADGE_PALETTE } from "../utils/badges";

// Hexagon (uchi tepada) — markaz (24,26), radius r. viewBox 48×52.
const hex = (r) =>
  [-90, -30, 30, 90, 150, 210]
    .map((a) => {
      const rad = (a * Math.PI) / 180;
      return `${(24 + r * Math.cos(rad)).toFixed(2)},${(26 + r * Math.sin(rad)).toFixed(2)}`;
    })
    .join(" ");
const HEX_OUTER = hex(22);
const HEX_BEVEL = hex(20);
const HEX_FACE = hex(18.4);

// Markaziy glif — 24×24 koordinatada, `currentColor` bilan. `inner` —
// ikkinchi darajali rang (alanga yuragi); soya qatlamida currentColor.
const STROKE = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" };
const GLYPHS = {
  // Kalendar + belgi
  perfectAttendance: () => (
    <g {...STROKE} strokeWidth="2.2">
      <rect x="4" y="5.5" width="16" height="14.5" rx="2.5" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
      <path d="M8.6 15.1l2.3 2.3 4.6-4.6" />
    </g>
  ),
  // Yulduz
  excellent: () => <path fill="currentColor" d="M12 2.6l2.85 5.95 6.45.8-4.75 4.45 1.2 6.4L12 17.05 6.25 20.2l1.2-6.4L2.7 9.35l6.45-.8z" />,
  // Toj
  perfect: () => (
    <g fill="currentColor">
      <path d="M3 7.8l4.6 3.7L12 4.2l4.4 7.3L21 7.8l-1.8 9.4H4.8z" />
      <rect x="4.8" y="18.4" width="14.4" height="2.4" rx="1" />
    </g>
  ),
  // Alanga
  attendanceStreak: (inner) => (
    <g>
      <path fill="currentColor" d="M12.3 2c.6 3.3 5.2 5.4 5.2 10.8a5.5 5.5 0 0 1-11 0c0-2.6 1.3-4.3 2.7-5.5.1 2 .9 3.3 2.2 3.9-.3-3.3.1-6.4.9-9.2z" />
      <path fill={inner} d="M12 12.6c.4 1.8 2.4 2.7 2.4 4.9a2.4 2.4 0 0 1-4.8 0c0-1.5 1-2.6 2.4-4.9z" />
    </g>
  ),
  // Chaqmoq
  gradeStreak: () => <path fill="currentColor" d="M13.6 2.2L4.8 13.6h6l-1.4 8.2 9-11.6h-6z" />,
  // Kubok
  champion: () => (
    <g>
      <path fill="currentColor" d="M7 3.5h10v5.5a5 5 0 0 1-10 0z" />
      <path {...STROKE} strokeWidth="1.8" d="M7 5.5H4.3v1.3A3.3 3.3 0 0 0 7.6 10M17 5.5h2.7v1.3a3.3 3.3 0 0 1-3.3 3.2" />
      <path fill="currentColor" d="M10.8 13.6h2.4v3.6h-2.4z" />
      <rect fill="currentColor" x="7.5" y="17.2" width="9" height="3.3" rx="1" />
    </g>
  ),
  // Yuqoriga strelka (o'sish)
  mostImproved: () => (
    <g {...STROKE} strokeWidth="2.6">
      <path d="M3.5 17.5l6-6 3.8 3.8 7.2-7.3" />
      <path d="M14.8 8h5.7v5.7" />
    </g>
  ),
  // Podium — uch pog'ona va yulduz
  podiumStreak: () => (
    <g fill="currentColor">
      <rect x="2.8" y="13" width="5.8" height="8.2" rx="1" />
      <rect x="9.1" y="9" width="5.8" height="12.2" rx="1" />
      <rect x="15.4" y="15.4" width="5.8" height="5.8" rx="1" />
      <path d="M12 1.8l1.1 2.3 2.5.3-1.85 1.75.47 2.48L12 7.42 9.78 8.63l.47-2.48L8.4 4.4l2.5-.3z" />
    </g>
  ),
  // Uchta medal: ikki chetdagisi orqada, oldingisi chegarali va yulduzli
  goldCollection: (inner) => (
    <g>
      <circle fill="currentColor" cx="5.4" cy="14.4" r="4.2" />
      <circle fill="currentColor" cx="18.6" cy="14.4" r="4.2" />
      <circle fill="currentColor" stroke={inner} strokeWidth="1.8" cx="12" cy="12" r="6.6" />
      <path fill={inner} d="M12 8.1l1.15 2.35 2.6.36-1.88 1.82.45 2.57L12 14.0l-2.32 1.2.45-2.57-1.88-1.82 2.6-.36z" />
    </g>
  ),
  // Ikki qavat yuqoriga strelka (sakrash)
  bigJump: () => (
    <g {...STROKE} strokeWidth="2.6">
      <path d="M5.5 12.5L12 6l6.5 6.5" />
      <path d="M5.5 19.5L12 13l6.5 6.5" />
    </g>
  ),
};

/**
 * Yutuq nishoni — metall olti burchakli emblem (docs/API_CONTRACT_badges_monthly_rank.md §D).
 * Client `src/ui/BadgeIcon.jsx` bilan bir xil dizayn.
 * Animatsiya (faqat `animated && earned`): kirishda pop + yaltiroq nur;
 * prefers-reduced-motion'da o'chadi (index.css).
 *
 * @param {Object} props
 * @param {string} props.type — BADGE_TYPES dan biri
 * @param {number} [props.size=40] — kenglik (px); balandlik ~1.08×
 * @param {boolean} [props.earned=true] — false → kulrang, xira
 * @param {number} [props.count] — >1 bo'lsa "×N" kapsula
 * @param {boolean} [props.animated=true]
 * @param {string} [props.label] — aria-label/title (i18n nomi)
 * @param {number} [props.delay=0] — animatsiya kechikishi (s), gridda navbat uchun
 */
export const BadgeIcon = ({ type, size = 40, earned = true, count, animated = true, label, delay = 0, className = "" }) => {
  const uid = useId().replace(/:/g, "");
  const p = BADGE_PALETTE[type];
  const glyph = GLYPHS[type];
  if (!p || !glyph) return null;
  const live = animated && earned;
  const h = (size * 52) / 48;
  const anim = live && delay ? { animationDelay: `${delay}s` } : undefined;

  return (
    <span
      role="img"
      aria-label={label || type}
      title={label}
      className={`relative inline-flex shrink-0 ${live ? "badge-pop" : ""} ${className}`}
      style={{ width: size, height: h, ...anim }}
    >
      <svg
        viewBox="0 0 48 52"
        width={size}
        height={h}
        className="overflow-visible"
        style={{
          filter: earned
            ? "drop-shadow(0 1.5px 1.5px rgba(15,23,42,0.28))"
            : "grayscale(1) drop-shadow(0 1px 1px rgba(15,23,42,0.12))",
          opacity: earned ? 1 : 0.42,
        }}
      >
        <defs>
          <linearGradient id={`f${uid}`} x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0%" stopColor={p.hi} />
            <stop offset="50%" stopColor={p.mid} />
            <stop offset="100%" stopColor={p.lo} />
          </linearGradient>
          {/* Qirra (bevel): tepasi yorug', pasti to'q — metall hajm */}
          <linearGradient id={`b${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.85" />
            <stop offset="45%" stopColor={p.hi} stopOpacity="0.5" />
            <stop offset="100%" stopColor={p.rim} stopOpacity="0.9" />
          </linearGradient>
          <clipPath id={`c${uid}`}>
            <polygon points={HEX_FACE} />
          </clipPath>
        </defs>

        {/* Champion — hexagon ortidan chiqib turgan qizil lenta uchlari */}
        {p.accent && (
          <g fill={p.accent}>
            <path d="M12 37h7v15l-3.5-2.6L12 52z" />
            <path d="M29 37h7v15l-3.5-2.6L29 52z" />
          </g>
        )}

        {/* Chekka (rim) — stroke-linejoin round burchaklarni yumshatadi */}
        <polygon points={HEX_OUTER} fill={p.rim} stroke={p.rim} strokeWidth="3" strokeLinejoin="round" />
        <polygon points={HEX_BEVEL} fill={p.lo} stroke={`url(#b${uid})`} strokeWidth="1.6" strokeLinejoin="round" />
        <polygon points={HEX_FACE} fill={`url(#f${uid})`} />

        <g clipPath={`url(#c${uid})`}>
          {/* Statik yaltiroq — yuzning yuqori yarmi */}
          <path d="M0 0h48v20C36 25 16 17 0 24z" fill="#fff" opacity="0.2" />
          {/* Harakatlanuvchi nur */}
          {live && (
            <rect
              x="20"
              y="-2"
              width="8"
              height="56"
              fill="#fff"
              opacity="0.5"
              className="badge-shine"
              style={{ transformBox: "fill-box", transformOrigin: "center", ...anim }}
            />
          )}
        </g>

        {/* Glif: bo'rttirma soya + asosiy rang */}
        <g transform="translate(13.2 15.4) scale(0.9)">
          <g transform="translate(0 0.9)" color={p.rim} opacity="0.55">
            {glyph("currentColor")}
          </g>
          <g color={p.glyph}>{glyph(p.mid)}</g>
        </g>
      </svg>

      {earned && count > 1 && (
        <span
          className="absolute -right-1 -bottom-0.5 rounded-full px-1 leading-none font-bold text-white tabular ring-2 ring-card"
          style={{ background: p.rim, fontSize: Math.max(9, Math.round(size * 0.22)), paddingTop: 2, paddingBottom: 2 }}
        >
          ×{count}
        </span>
      )}
    </span>
  );
};
