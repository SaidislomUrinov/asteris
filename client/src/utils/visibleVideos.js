// Har bir rolda ochiq bo'limlar (menyuda bo'lmasa ham marshruti bor).
const ALWAYS = ["dashboard", "notifications", "profile", "video-lessons"];
// Detail videosi — ota bo'lim ko'rinsa (`/students/:id` o'qituvchida boshqa sahifa).
const DETAIL_PARENT = { "groups/detail": "groups", "rooms/detail": "rooms", "students/detail": "students" };

/**
 * Video qo'llanmalar — Owner hammasini ko'radi, hodim (o'qituvchi, resepshin...)
 * faqat o'zi kira oladigan bo'limlar videosini (docs/API_CONTRACT_individual_coins.md §5).
 * `items` — menyu bandlari, `tabs` — bo'lim tablari: ular App.jsx marshrutlari
 * bilan bir xil rol/ruxsat/tarif shartlariga ega.
 */
export const filterVisibleVideos = (videos, authType, items, tabs) => {
  if (authType === "owner") return videos;
  const allowed = new Set([
    ...ALWAYS,
    ...items.filter((i) => !i.match).map((i) => i.to.slice(1)),
    ...tabs.map((tab) => tab.to.slice(1)),
  ]);
  return videos.filter((v) => allowed.has(DETAIL_PARENT[v.sectionKey] || v.sectionKey));
};
