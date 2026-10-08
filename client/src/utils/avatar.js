const PALETTE = [
  "#f87171",
  "#fb923c",
  "#fbbf24",
  "#34d399",
  "#22d3ee",
  "#60a5fa",
  "#a78bfa",
  "#f472b6",
  "#4ade80",
  "#facc15",
];

/**
 * Berilgan id (yoki har qanday string) asosida barqaror rang qaytaradi.
 * Bir xil id doim bir xil rangni beradi.
 * @param {string} id
 * @returns {string} hex color
 */
export function getAvatarColor(id = "") {
  const str = String(id || "x");
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  const index = Math.abs(hash) % PALETTE.length;
  return PALETTE[index];
}

/**
 * Ism va familiyadan bosh harflarni chiqaradi.
 * @param {string} name
 * @param {string} lastName
 * @returns {string}
 */
export function getInitials(name = "", lastName = "") {
  const words = (name || "").trim().split(/\s+/);
  const a = words[0]?.[0] || "";
  // `fullName` bitta satr bo'lib kelsa ("Iroda Nurmatova") — 2-so'zdan olinadi.
  const b = (lastName || "").trim()[0] || words[1]?.[0] || "";
  const initials = `${a}${b}`.toUpperCase();
  return initials || "?";
}
