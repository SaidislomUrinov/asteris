import { setActiveCenter } from "./fetching";

// Filial almashtirilganda — bo'limning ildiz sahifasiga (detail sahifa boshqa
// filialniki bo'lib qolmasin, URL filtrlari eski filial id'larini saqlamasin).
const sectionRoot = (pathname) => `/${pathname.split("/").filter(Boolean)[0] || "dashboard"}`;

/**
 * Faol filialni almashtirish (docs/API_CONTRACT_multi_center.md §5) — bitta
 * to'liq reload. Filial bilan bog'liq vaqtinchalik holat (ro'yxat filtrlari —
 * usePersistedState) sessionStorage'da; til, mavzu, sessiya va boshqa shaxsiy
 * sozlamalar localStorage'da qoladi.
 * @param {string} centerId
 */
export default function switchCenter(centerId) {
  setActiveCenter(centerId);
  try {
    sessionStorage.clear();
  } catch {
    // sessionStorage yo'q — reload baribir holatni tozalaydi
  }
  window.location.replace(sectionRoot(window.location.pathname));
}
