import { API } from "../api/http";

// `API` = ".../api" — `/uploads/...` yo'llari server ildiziga nisbatan
// (lib/qrCard.js, worker/support/chatUtils.js bilan bir xil).
const ORIGIN = API.replace(/\/api\/?$/, "");

// Rasm manzili: to'liq URL (http/blob:/data:) — o'zgarishsiz, aks holda
// serverdagi nisbiy yo'l (`/uploads/...`) — server originiga ulanadi.
export const photoSrc = (photo) => {
  if (!photo || typeof photo !== "string") return "";
  if (/^(https?:|blob:|data:)/.test(photo)) return photo;
  return `${ORIGIN}${photo}`;
};

const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.85;

const loadImage = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("decode"));
    img.src = url;
  });

const toBlob = (canvas) =>
  new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/jpeg", JPEG_QUALITY));

/**
 * Yuklashdan oldin rasmni brauzerda kichraytiradi — uzun tomoni ≤1600px,
 * JPEG q≈0.85 (mobil trafikni tejash, docs/API_CONTRACT_student_photo.md §5).
 * Dekod qilib bo'lmasa (masalan Chrome'da HEIC) — asl fayl qaytariladi,
 * server o'zi qayta ishlaydi. Kvadrat kesish serverda.
 *
 * @param {File} file
 * @returns {Promise<File|Blob>}
 */
export async function downscaleImage(file) {
  if (!file || typeof document === "undefined") return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const { naturalWidth: w, naturalHeight: h } = img;
    if (!w || !h) return file;
    const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    // PNG shaffofligi JPEG'da qora bo'lib qolmasligi uchun oq fon.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await toBlob(canvas);
    // Kichraytirish foyda bermasa (kichik, allaqachon siqilgan rasm) — asl fayl.
    if (!blob || (scale === 1 && blob.size >= file.size)) return file;
    const name = (file.name || "photo").replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}
