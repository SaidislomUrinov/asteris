// Bir martalik konfetti portlashi — markazdan tashqariga uchadigan rangli
// bo'lakchalar (faqat CSS, kutubxonasiz). Tasodif o'rniga index asosidagi
// deterministik "tasodif" — render toza qoladi. reduced-motion'da yashirin.
const COLORS = {
  1: ["#F5C542", "#FFE27A", "#B7791F", "#2563EB", "#ffffff"],
  2: ["#CBD5E1", "#94A3B8", "#F1F5F9", "#DC2626", "#ffffff"],
  3: ["#D98B4B", "#F4B183", "#8C4A1C", "#16A34A", "#ffffff"],
};
const COUNT = 28;
const rnd = (i, salt) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export const Confetti = ({ tone = 1, className = "" }) => {
  const palette = COLORS[tone] || COLORS[1];
  return (
    <span aria-hidden className={`pointer-events-none absolute inset-0 overflow-visible ${className}`}>
      {Array.from({ length: COUNT }).map((_, i) => {
        // Asosan yuqoriga va yon tomonlarga (-200°…+20° oralig'i)
        const angle = (-200 + rnd(i, 1) * 220) * (Math.PI / 180);
        const dist = 45 + rnd(i, 2) * 70;
        const w = 4 + Math.round(rnd(i, 3) * 4);
        const round = rnd(i, 4) > 0.6;
        return (
          <span
            key={i}
            className="confetti-piece absolute left-1/2 top-1/2"
            style={{
              width: w,
              height: round ? w : w * 1.8,
              marginLeft: -w / 2,
              marginTop: -w / 2,
              borderRadius: round ? 999 : 1.5,
              background: palette[i % palette.length],
              "--dx": `${Math.cos(angle) * dist}px`,
              "--dy": `${Math.sin(angle) * dist + 30}px`,
              "--rot": `${Math.round(rnd(i, 5) * 720 - 360)}deg`,
              "--dur": `${1 + rnd(i, 6) * 0.8}s`,
              "--delay": `${0.25 + rnd(i, 7) * 0.2}s`,
            }}
          />
        );
      })}
    </span>
  );
};
