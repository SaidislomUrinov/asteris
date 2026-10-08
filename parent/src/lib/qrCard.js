import QRCode from "qrcode";
import { API } from "../api/http";

// O'quvchining QR davomat kartasi — client'dagi
// `client/src/pages/Students/qrCard.util.js` `renderQrCard()` ning AYNAN porti
// (API_CONTRACT_qr_card_send_and_worker_chat.md §A.1): dizayn manbai o'sha
// util, o'zgarsa ikkalasi ham. Farqi: matn kalitlari `worker.qr.card.*`,
// logo manzili parent `API` (".../api") ga moslangan va natija PNG Blob.
// Yagona manba: ishchi paneli (worker/qr/useSendQrCard) va ota-ona/o'quvchi
// QR karta ekrani (pages/Group/QrCardSheet) shu fayldan foydalanadi.

// Karta shrifti index.css'da Google Fonts orqali ulanadi, lekin sahifada
// ishlatilmagani uchun brauzer uni yuklamaydi — canvas'ga chizishdan oldin
// kerakli og'irliklar majburan yuklanadi (bo'lmasa fallback shrift chiqadi).
const ensureFonts = async () => {
  try {
    if (document.fonts?.load) {
      await Promise.all(["500", "600", "700"].map((w) => document.fonts.load(`${w} 24px "Space Grotesk"`)));
    }
    if (document.fonts?.ready) await document.fonts.ready;
  } catch {
    /* shrift yuklanmasa — fallback bilan chiziladi */
  }
};

const CARD_MM = { w: 85.6, h: 54 };
const SCALE = 12; // 1 mm = 12 px (~305 dpi) — chop etishda tiniq
const W = Math.round(CARD_MM.w * SCALE);
const H = Math.round(CARD_MM.h * SCALE);
const FONT = '"Space Grotesk", "Inter", "Segoe UI", system-ui, sans-serif';

// Client'da `API` server ildizi; parent'da `API` = ".../api" — logo yo'li
// (`/uploads/...`) server ildiziga nisbatan.
const ORIGIN = API.replace(/\/api\/?$/, "");
const logoUrl = (logo) => (!logo ? "" : logo.startsWith("http") ? logo : `${ORIGIN}${logo}`);

const loadImage = (src) =>
  new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Matnni berilgan kenglikka sig'dirib, kerak bo'lsa 2 qatorga bo'ladi va
// oxirini "…" bilan kesadi.
function wrapLines(ctx, text, maxWidth, maxLines) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] += "…";
  }
  return lines.map((l) => {
    let out = l;
    while (ctx.measureText(out).width > maxWidth && out.length > 1) out = `${out.slice(0, -2)}…`;
    return out;
  });
}

// Fon keshlanadi — guruh PDF'ida bir xil logo har karta uchun qayta
// yuklanmasin.
const logoCache = new Map();
const getLogo = (logo) => {
  const url = logoUrl(logo);
  if (!logoCache.has(url)) logoCache.set(url, loadImage(url));
  return logoCache.get(url);
};

/**
 * @param {{ fullName, qrToken, centerName, centerLogo, groups: string[] }} card
 * @param {(key: string) => string} t
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function renderQrCard(card, t) {
  await ensureFonts();

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Fon — oq karta, chapda to'q ko'k vertikal urg'u bandi.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  const pad = 44;
  const qrBox = 420;
  const qrX = W - pad - qrBox;
  const qrY = (H - qrBox) / 2 + 18;

  // Yuqori sarlavha bandi
  const bandH = 128;
  const grad = ctx.createLinearGradient(0, 0, W, bandH);
  grad.addColorStop(0, "#0f172a");
  grad.addColorStop(1, "#1e3a8a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, bandH);

  // Logo yoki bosh harf
  const logo = await getLogo(card.centerLogo);
  const logoSize = 72;
  const logoY = (bandH - logoSize) / 2;
  ctx.save();
  roundRect(ctx, pad, logoY, logoSize, logoSize, 18);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.clip();
  if (logo) {
    const ratio = Math.max(logoSize / logo.width, logoSize / logo.height);
    const lw = logo.width * ratio;
    const lh = logo.height * ratio;
    ctx.drawImage(logo, pad + (logoSize - lw) / 2, logoY + (logoSize - lh) / 2, lw, lh);
  } else {
    ctx.fillStyle = "#2563eb";
    ctx.font = `700 38px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((card.centerName || "W").trim().charAt(0).toUpperCase(), pad + logoSize / 2, logoY + logoSize / 2 + 2);
  }
  ctx.restore();

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const headX = pad + logoSize + 22;
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 34px ${FONT}`;
  const [centerLine] = wrapLines(ctx, card.centerName || "—", W - headX - pad - 190, 1);
  ctx.fillText(centerLine, headX, bandH / 2 - 2);
  ctx.fillStyle = "rgba(191,219,254,0.9)";
  ctx.font = `600 22px ${FONT}`;
  ctx.fillText(t("worker.qr.card.label").toUpperCase(), headX, bandH / 2 + 30);

  // O'ng yuqori — brend belgisi
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `700 22px ${FONT}`;
  ctx.fillText("WENET", W - pad, bandH / 2 + 8);

  // QR — oq, nozik chegarali quti ichida
  ctx.save();
  ctx.shadowColor = "rgba(15,23,42,0.16)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 6;
  roundRect(ctx, qrX, qrY, qrBox, qrBox, 28);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 2;
  roundRect(ctx, qrX, qrY, qrBox, qrBox, 28);
  ctx.stroke();

  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, card.qrToken, {
    width: qrBox - 40,
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: "#0f172a", light: "#ffffff" },
  });
  ctx.drawImage(qrCanvas, qrX + 20, qrY + 20, qrBox - 40, qrBox - 40);

  // Chap ustun — o'quvchi
  ctx.textAlign = "left";
  const leftW = qrX - pad - 36;
  let y = bandH + 78;
  ctx.fillStyle = "#94a3b8";
  ctx.font = `600 20px ${FONT}`;
  ctx.fillText(t("worker.qr.card.student").toUpperCase(), pad, y);

  y += 50;
  ctx.fillStyle = "#0f172a";
  ctx.font = `700 46px ${FONT}`;
  const nameLines = wrapLines(ctx, card.fullName, leftW, 2);
  nameLines.forEach((line) => {
    ctx.fillText(line, pad, y);
    y += 54;
  });

  const groups = (card.groups || []).filter(Boolean);
  if (groups.length) {
    y += 20;
    ctx.fillStyle = "#94a3b8";
    ctx.font = `600 20px ${FONT}`;
    ctx.fillText(t("worker.qr.card.groups").toUpperCase(), pad, y);
    y += 16;

    ctx.font = `600 24px ${FONT}`;
    let x = pad;
    const chipH = 42;
    let rows = 0;
    const shown = groups.slice(0, 4);
    for (let i = 0; i < shown.length; i++) {
      const [label] = wrapLines(ctx, shown[i], leftW - 28, 1);
      const cw = ctx.measureText(label).width + 28;
      if (x + cw > pad + leftW && x > pad) {
        rows += 1;
        x = pad;
      }
      if (rows > 1) break;
      const cy = y + rows * (chipH + 10);
      roundRect(ctx, x, cy, cw, chipH, 12);
      ctx.fillStyle = "#eff6ff";
      ctx.fill();
      ctx.fillStyle = "#1d4ed8";
      ctx.fillText(label, x + 14, cy + 29);
      x += cw + 10;
    }
  }

  // Pastki izoh
  ctx.fillStyle = "#94a3b8";
  ctx.font = `500 19px ${FONT}`;
  ctx.fillText(t("worker.qr.card.footer"), pad, H - pad + 6);

  // Pastki urg'u chizig'i
  ctx.fillStyle = "#2563eb";
  ctx.fillRect(0, H - 10, W, 10);

  return canvas;
}

// Canvas → PNG Blob (serverga multipart `card` sifatida yuboriladi).
export const qrCardBlob = async (card, t) => {
  const canvas = await renderQrCard(card, t);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("attendance.qrInvalidImage"))), "image/png");
  });
};
