import useTheme from "../../hooks/useTheme";

// Grafiklarning umumiy palitrasi va yuzalari (Chart Lab'da tasdiqlangan,
// docs/API_CONTRACT_monthly_charts.md). Ranglar dataviz validatori bilan
// tekshirilgan: to'langan/qarz juftligi yorug' (#fcfcfb) va tungi (#0d1830)
// yuzada PASS.
export const PAID_COLOR = "#3b82f6";
export const DEBT_COLOR = "#ef4444";
export const REVENUE_COLOR = "#10b981";

export const useChartTheme = () => {
  const { isDark } = useTheme();
  return {
    isDark,
    surface: isDark ? "#0d1830" : "#ffffff",
    grid: isDark ? "#1e2e52" : "#eef2f7",
    axis: isDark ? "#64748b" : "#94a3b8",
    cursor: isDark ? "#2b3d66" : "#cbd5e1",
    ink: isDark ? "#e2e8f0" : "#0f172a",
    track: isDark ? "#14223f" : "#f1f5f9",
  };
};

export const money = (v) => Number(v || 0).toLocaleString("uz-UZ");

// O'q va yorliqlar uchun ixcham: 850 ming, 1,2 mln, 18 mln. Bo'shliq —
// bo'linmas (NBSP), aks holda recharts matnni ikki qatorga o'rab yuboradi.
export const compact = (v, t) => {
  const n = Number(v || 0);
  const mln = t ? t("chart.mln") : "mln";
  const ming = t ? t("chart.thousand") : "ming";
  if (n >= 1_000_000) {
    const val = (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "").replace(".", ",");
    return `${val}\u00a0${mln}`;
  }
  if (n >= 1_000) return `${Math.round(n / 1_000)}\u00a0${ming}`;
  return String(n);
};
