// Yutuq nishonlari (docs/API_CONTRACT_badges_monthly_rank.md §C/§D).
// Tartib server `utils/badge.util.js#BADGE_TYPES` va client bilan AYNAN bir xil.
export const BADGE_TYPES = [
  "perfectAttendance",
  "excellent",
  "perfect",
  "attendanceStreak",
  "gradeStreak",
  "champion",
  "mostImproved",
  "podiumStreak",
  "goldCollection",
  "bigJump",
];

// Markaz baholarni yashirsa (`showGrades=false`) server bu turlarni qaytarmaydi.
export const GRADE_BADGE_TYPES = [
  "excellent",
  "perfect",
  "gradeStreak",
  "champion",
  "mostImproved",
  "podiumStreak",
  "goldCollection",
  "bigJump",
];

// Metall emblem palitrasi: hi → mid → lo — yuz gradienti, rim — chekka qirra,
// glyph — markaziy belgi rangi, accent — ikkinchi rang (champion: qizil lenta).
// Client `src/ui/BadgeIcon.jsx` bilan bir xil qiymatlar.
export const BADGE_PALETTE = {
  perfectAttendance: { hi: "#A7F3D0", mid: "#10B981", lo: "#047857", rim: "#064E3B", glyph: "#ECFDF5" },
  excellent: { hi: "#BFDBFE", mid: "#3B82F6", lo: "#1D4ED8", rim: "#1E3A8A", glyph: "#EFF6FF" },
  perfect: { hi: "#FFF3B0", mid: "#F5C542", lo: "#B7791F", rim: "#8A5A0B", glyph: "#FFFBEB" },
  attendanceStreak: { hi: "#FDE68A", mid: "#F97316", lo: "#DC2626", rim: "#7F1D1D", glyph: "#FFF7ED" },
  gradeStreak: { hi: "#E9D5FF", mid: "#A855F7", lo: "#6D28D9", rim: "#4C1D95", glyph: "#FAF5FF" },
  champion: { hi: "#FFF3B0", mid: "#F5C542", lo: "#B7791F", rim: "#991B1B", glyph: "#FFFBEB", accent: "#DC2626" },
  mostImproved: { hi: "#99F6E4", mid: "#14B8A6", lo: "#0F766E", rim: "#134E4A", glyph: "#F0FDFA" },
  podiumStreak: { hi: "#FECDD3", mid: "#F43F5E", lo: "#BE123C", rim: "#881337", glyph: "#FFF1F2" },
  goldCollection: { hi: "#FEF3C7", mid: "#F59E0B", lo: "#B45309", rim: "#78350F", glyph: "#FFFBEB", accent: "#2563EB" },
  bigJump: { hi: "#BAE6FD", mid: "#0EA5E9", lo: "#0369A1", rim: "#0C4A6E", glyph: "#F0F9FF" },
};

const clamp = (v) => Math.max(0, Math.min(1, v));

/**
 * Joriy oy progressini UI shakliga keltiradi.
 * state: "met" — shart hozircha bajarilmoqda (yashil), "broken" — shu oy uchun
 * endi olib bo'lmaydi, "progress" — yo'lda.
 * @returns {{ pct:number, value:string, state:"met"|"broken"|"progress", hint?:{key:string, opts?:object} }}
 */
export const badgeProgress = (type, p) => {
  if (!p) return { pct: 0, value: "—", state: "progress" };
  switch (type) {
    case "perfectAttendance": {
      const held = p.target ?? 0;
      const min = p.min ?? 4;
      const absent = p.absent ?? Math.max(0, held - (p.current ?? 0));
      if (absent > 0) return { pct: clamp((p.current ?? 0) / Math.max(held, 1)), value: `${p.current ?? 0}/${held}`, state: "broken", hint: { key: "badge.hint.absent", opts: { count: absent } } };
      const max = Math.max(held, min);
      return { pct: clamp((p.current ?? 0) / max), value: `${p.current ?? 0}/${max}`, state: held >= min ? "met" : "progress" };
    }
    case "excellent": {
      const min = p.min ?? 4;
      // `broken` — server: shu oyda 8 dan past baho bor (`minValue` — shart chegarasi, eng past baho EMAS).
      if (p.broken) return { pct: clamp((p.current ?? 0) / min), value: `${p.current ?? 0}/${min}`, state: "broken", hint: { key: "badge.hint.lowGrade", opts: { v: p.minValue ?? 8 } } };
      return { pct: clamp((p.current ?? 0) / min), value: `${Math.min(p.current ?? 0, min)}/${min}`, state: (p.current ?? 0) >= min ? "met" : "progress" };
    }
    case "perfect": {
      const min = p.min ?? 4;
      const total = p.target ?? 0;
      const tens = p.current ?? 0;
      if (tens < total) return { pct: clamp(tens / Math.max(total, min)), value: `${tens}/${total}`, state: "broken", hint: { key: "badge.hint.notTen" } };
      const max = Math.max(total, min);
      return { pct: clamp(tens / max), value: `${tens}/${max}`, state: total >= min ? "met" : "progress" };
    }
    case "attendanceStreak":
    case "gradeStreak": {
      const target = p.target ?? (type === "gradeStreak" ? 5 : 10);
      // Seriya shu oyda yetgan bo'lsa server counter'ni 0 ga qaytaradi — `achieved` ga qaraymiz.
      if (p.achieved) return { pct: 1, value: `${target}/${target}`, state: "met" };
      return { pct: clamp((p.current ?? 0) / target), value: `${p.current ?? 0}/${target}`, state: "progress" };
    }
    case "champion": {
      if (p.position == null || !p.total) return { pct: 0, value: "—", state: "progress", hint: { key: "badge.hint.noRank" } };
      const pct = p.total > 1 ? (p.total - p.position) / (p.total - 1) : 1;
      return { pct: clamp(pct), value: `${p.position}/${p.total}`, state: p.position === 1 ? "met" : "progress" };
    }
    case "mostImproved": {
      if (p.delta == null) return { pct: 0, value: "—", state: "progress", hint: { key: "badge.hint.noCompare" } };
      const d = Math.round(p.delta * 10) / 10;
      return {
        pct: clamp(d / 2),
        value: `${d > 0 ? "+" : ""}${d}`,
        // "Guruhda eng katta o'sish" — faqat oy oxirida aniq bo'ladi, shuning
        // uchun "met" emas; ijobiy o'sish yashil raqam bilan ko'rsatiladi.
        state: "progress",
        positive: d > 0,
        hint: p.prevAverage != null && p.average != null ? { key: "badge.hint.delta", opts: { from: p.prevAverage, to: p.average } } : undefined,
      };
    }
    case "podiumStreak": {
      const target = p.target ?? 3;
      if (p.achieved) return { pct: 1, value: `${target}/${target}`, state: "met" };
      const cur = p.current ?? 0;
      return {
        pct: clamp(cur / target),
        value: `${cur}/${target}`,
        state: "progress",
        hint: p.podiumNow ? undefined : { key: "badge.hint.notPodium" },
      };
    }
    case "goldCollection": {
      const target = p.target ?? 3;
      if (p.achieved || p.done) return { pct: 1, value: `${target}/${target}`, state: "met" };
      return { pct: clamp((p.current ?? 0) / target), value: `${p.current ?? 0}/${target}`, state: "progress" };
    }
    case "bigJump": {
      if (p.prevPosition == null || p.position == null) return { pct: 0, value: "—", state: "progress", hint: { key: "badge.hint.needTwoMonths" } };
      const jump = p.jump ?? p.prevPosition - p.position;
      const target = p.target ?? 5;
      return {
        pct: clamp(jump / target),
        value: `${jump > 0 ? "+" : ""}${jump}`,
        state: p.achieved ? "met" : "progress",
        positive: jump > 0,
        hint: { key: "badge.hint.positions", opts: { from: p.prevPosition, to: p.position } },
      };
    }
    default:
      return { pct: 0, value: "—", state: "progress" };
  }
};
