import { useCallback, useSyncExternalStore } from "react";

// Kunduzgi/tungi rejim. Haqiqat manbai — `<html class="dark">` (Tailwind
// `dark:` varianti shunga qaraydi, index.css). Tanlov shu brauzerda
// `localStorage`da saqlanadi; index.html'dagi dastlabki skript ham shu
// kalitni o'qiydi (React yuklanguncha oq miltillash bo'lmasligi uchun).
const KEY = "wenet:theme";
const listeners = new Set();

const isDark = () => document.documentElement.classList.contains("dark");

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const setTheme = (theme) => {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Saqlab bo'lmasa ham joriy sessiyada ishlayveradi.
  }
  listeners.forEach((fn) => fn());
};

/**
 * @returns {{ theme: "light" | "dark", isDark: boolean, toggle: () => void }}
 * Grafiklar (Recharts) kabi `dark:` klassi bilan bo'yalmaydigan joylar
 * `isDark` bo'yicha rang tanlaydi.
 */
export default function useTheme() {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);
  const toggle = useCallback(() => setTheme(isDark() ? "light" : "dark"), []);
  return { theme: dark ? "dark" : "light", isDark: dark, toggle };
}
