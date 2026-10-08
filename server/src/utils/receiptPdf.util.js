const fs = require("fs");
const path = require("path");
const moment = require("moment-timezone");
const { jsPDF } = require("jspdf");
const QRCode = require("qrcode");

// To'lov cheki PDF — client'dagi `client/src/pages/Students/receiptPdf.util.js`
// bilan BIR XIL dizayn ("summa birinchi": yashil summa, tishli ajratuvchi,
// kalit–qiymat, oy kesimidagi qarzdorlik qutisi, QR, Wenet brend qatori).
// Farqi: brauzerda `doc.save()` o'rniga Buffer qaytaradi — fayl DISKKA
// YOZILMAYDI, Telegram'ga to'g'ridan-to'g'ri xotiradan yuboriladi
// (API_CONTRACT_receipt_pdf.md §5). Client'dagi dizayn o'zgarsa — shu yerda ham.

const RECEIPT_VERIFY_BASE = "https://wenet.uz/payment/verify";
const TZ = "Asia/Tashkent";

const PAGE_W = 320;
const MARGIN = 26;
const QR_SIZE = 64;
const DEBT_ROW_H = 15;
const MAX_DEBT_ROWS = 8;

const INK = [15, 23, 42];
const MUTED = [100, 116, 139];
const FAINT = [148, 163, 184];
const LINE = [226, 232, 240];
const GREEN = [15, 150, 96];
const RED = [220, 38, 38];

// Helvetica (jsPDF standart shrifti) kirillni chiza olmaydi — rus tilida
// DejaVu Sans ichiga joylanadi. Fayllar bir marta o'qiladi (base64 kesh).
const FONT_DIR = path.join(__dirname, "../assets/fonts");
let dejavuCache = null;
const dejavu = () => {
  if (!dejavuCache) {
    dejavuCache = {
      normal: fs.readFileSync(path.join(FONT_DIR, "DejaVuSans.ttf")).toString("base64"),
      bold: fs.readFileSync(path.join(FONT_DIR, "DejaVuSans-Bold.ttf")).toString("base64"),
    };
  }
  return dejavuCache;
};

const newDoc = (height, useDejavu) => {
  const doc = new jsPDF({ unit: "pt", format: [PAGE_W, height] });
  if (useDejavu) {
    const f = dejavu();
    doc.addFileToVFS("DejaVuSans.ttf", f.normal);
    doc.addFont("DejaVuSans.ttf", "dejavu", "normal");
    doc.addFileToVFS("DejaVuSans-Bold.ttf", f.bold);
    doc.addFont("DejaVuSans-Bold.ttf", "dejavu", "bold");
  }
  return doc;
};

const formatMonth = (forMonth, monthNames) => {
  if (!forMonth) return "—";
  const [year, month] = String(forMonth).split("-").map(Number);
  if (!year || !month) return String(forMonth);
  return `${monthNames[month - 1] || ""} ${year}`;
};

// "2026-04" -> "04-2026" — qarzdorlik ro'yxatidagi qisqa oy belgisi.
const monthCode = (forMonth) => {
  if (!forMonth) return "—";
  const [year, month] = String(forMonth).split("-");
  if (!year || !month) return String(forMonth);
  return `${month}-${year}`;
};

// Client'dagi `toLocaleString("uz-UZ")` bilan bir xil guruhlash (bo'shliq).
const formatSum = (n, som) => `${Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ${som}`;

const drawPerforation = (doc, y) => {
  doc.setFillColor(255, 255, 255);
  doc.circle(0, y, 10, "F");
  doc.circle(PAGE_W, y, 10, "F");
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(1);
  doc.setLineDashPattern([4, 3], 0);
  doc.line(16, y, PAGE_W - 16, y);
  doc.setLineDashPattern([], 0);
};

/**
 * @param {Object} data
 * @param {string} data.centerName
 * @param {string} data.groupLabel
 * @param {string} data.studentName
 * @param {string} data.phone
 * @param {number} data.amount
 * @param {number} data.remainingDebt
 * @param {Array<{kind:string, month:string|null, debt:number}>} data.debtBreakdown
 * @param {string} data.forMonth — "YYYY-MM"
 * @param {string} data.code — to'lov tekshirish kodi (QR)
 * @param {number} [data.paidAt] — unix soniya
 * @param {Object} tr — { lang, t(key), monthNames: string[] }
 * @returns {Promise<Buffer>}
 */
const buildPaymentReceiptPdf = async (data, tr) => {
  const { centerName, groupLabel, studentName, phone, amount, remainingDebt = 0, debtBreakdown = [], forMonth, code, paidAt } = data;
  const { t, monthNames } = tr;
  const useDejavu = tr.lang === "ru";
  const FONT = useDejavu ? "dejavu" : "helvetica";
  const som = t("receiptSom");
  const hasDebt = remainingDebt > 0;

  const allDebtRows = (debtBreakdown || []).filter((r) => r?.debt > 0);
  const debtRows = allDebtRows.slice(0, MAX_DEBT_ROWS);
  const hiddenRowCount = allDebtRows.length - debtRows.length;

  const qrValue = code ? `${RECEIPT_VERIFY_BASE}/${code}` : RECEIPT_VERIFY_BASE;
  const qrDataUrl = await QRCode.toDataURL(qrValue, {
    margin: 0,
    width: 256,
    color: { dark: "#0f172a", light: "#ffffff" },
  });

  const when = paidAt ? moment.unix(paidAt) : moment();
  const dateStr = when.tz(TZ).format("DD.MM.YYYY, HH:mm");
  const contentW = PAGE_W - MARGIN * 2;

  const KV_LABEL_W = 62;
  const kvValueW = contentW - KV_LABEL_W;
  const kvRows = [
    { label: t("receiptStudentLabel"), value: studentName || "—", sub: phone || "" },
    { label: t("receiptGroupLabel"), value: groupLabel || "—" },
    { label: t("receiptCenterLabel"), value: centerName || "—" },
  ];

  // `dry` — faqat balandlikni o'lchash; chizmaydi (jsPDF'da sahifa o'lchami
  // keyin o'zgarmaydi, shuning uchun ikki o'tish).
  const render = (doc, dry) => {
    const text = (...args) => {
      if (!dry) doc.text(...args);
    };
    let y = 38;

    // ---- Summa (hero) ----
    doc.setFont(FONT, "normal");
    doc.setFontSize(8);
    doc.setTextColor(...FAINT);
    text(t("receiptPaidLabel").toUpperCase(), PAGE_W / 2, y, { align: "center" });
    y += 26;
    doc.setFont(FONT, "bold");
    doc.setFontSize(26);
    doc.setTextColor(...GREEN);
    text(formatSum(amount, som), PAGE_W / 2, y, { align: "center", maxWidth: contentW });
    y += 16;
    doc.setFont(FONT, "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED);
    text(`${formatMonth(forMonth, monthNames)}  ·  ${dateStr}`, PAGE_W / 2, y, { align: "center", maxWidth: contentW });

    y += 24;
    if (!dry) drawPerforation(doc, y);
    y += 30;

    // ---- Kalit–qiymat ----
    for (const row of kvRows) {
      doc.setFont(FONT, "bold");
      doc.setFontSize(11);
      const lines = doc.splitTextToSize(String(row.value), kvValueW);

      doc.setFont(FONT, "normal");
      doc.setFontSize(8);
      doc.setTextColor(...FAINT);
      text(row.label.toUpperCase(), MARGIN, y);

      doc.setFont(FONT, "bold");
      doc.setFontSize(11);
      doc.setTextColor(...INK);
      text(lines, MARGIN + KV_LABEL_W, y);
      y += lines.length * 13;

      if (row.sub) {
        doc.setFont(FONT, "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(...MUTED);
        text(row.sub, MARGIN + KV_LABEL_W, y);
        y += 12;
      }
      y += 8;
    }

    y += 8;

    // ---- Qarzdorlik qutisi ----
    // Qator yorlig'i uzun bo'lsa (masalan rus tilida "Месяц не указан - Старый
    // долг") o'raladi — qator balandligi qatorlar soniga qarab o'sadi, aks holda
    // keyingi qator ustiga tushardi.
    doc.setFont(FONT, "bold");
    doc.setFontSize(10);
    const rowLines = debtRows.map((row) =>
      doc.splitTextToSize(
        row.kind === "opening"
          ? `${row.month ? monthCode(row.month) : t("receiptOpeningMonthUnknown")} - ${t("receiptOpeningBadge")}`
          : monthCode(row.month),
        contentW - 110,
      ),
    );
    const rowsH = rowLines.reduce((sum, lines) => sum + DEBT_ROW_H + (lines.length - 1) * 12, 0);
    const boxH = debtRows.length ? 26 + rowsH + (hiddenRowCount > 0 ? DEBT_ROW_H : 0) + 22 : 40;
    const boxRight = MARGIN + contentW - 10;
    if (!dry) {
      doc.setDrawColor(...LINE);
      doc.setLineWidth(1);
      doc.roundedRect(MARGIN, y, contentW, boxH, 4, 4, "S");
    }
    doc.setFont(FONT, "normal");
    doc.setFontSize(8);
    doc.setTextColor(...FAINT);
    text(t("receiptDebtLabel").toUpperCase(), MARGIN + 10, y + 14);

    if (debtRows.length) {
      let rowY = y + 30;
      doc.setFontSize(10);
      debtRows.forEach((row, i) => {
        doc.setFont(FONT, "bold");
        doc.setTextColor(51, 65, 85);
        text(rowLines[i], MARGIN + 10, rowY);
        doc.setTextColor(...RED);
        text(formatSum(row.debt, som), boxRight, rowY, { align: "right" });
        rowY += DEBT_ROW_H + (rowLines[i].length - 1) * 12;
      });
      if (hiddenRowCount > 0) {
        doc.setFont(FONT, "normal");
        doc.setFontSize(9);
        doc.setTextColor(...FAINT);
        text(t("receiptDebtMoreMonths").replace("{count}", String(hiddenRowCount)), MARGIN + 10, rowY);
        rowY += DEBT_ROW_H;
      }
      if (!dry) {
        doc.setDrawColor(...LINE);
        doc.line(MARGIN + 10, rowY - 6, boxRight, rowY - 6);
      }
      doc.setFont(FONT, "normal");
      doc.setFontSize(8);
      doc.setTextColor(...FAINT);
      text(t("receiptDebtTotalLabel").toUpperCase(), MARGIN + 10, rowY + 8);
      doc.setFont(FONT, "bold");
      doc.setFontSize(11);
      doc.setTextColor(...RED);
      text(formatSum(remainingDebt, som), boxRight, rowY + 8, { align: "right" });
    } else {
      doc.setFont(FONT, "bold");
      doc.setFontSize(12);
      doc.setTextColor(...(hasDebt ? RED : MUTED));
      text(hasDebt ? formatSum(remainingDebt, som) : t("receiptNoDebt"), MARGIN + 10, y + 30);
    }
    y += boxH + 26;

    // ---- QR (markazda) ----
    if (!dry) doc.addImage(qrDataUrl, "PNG", (PAGE_W - QR_SIZE) / 2, y, QR_SIZE, QR_SIZE);
    y += QR_SIZE + 14;
    doc.setFont(FONT, "normal");
    doc.setFontSize(8);
    doc.setTextColor(...FAINT);
    const hintLines = doc.splitTextToSize(t("receiptVerifyHint"), contentW - 40);
    text(hintLines, PAGE_W / 2, y, { align: "center" });
    y += hintLines.length * 10 + 14;

    // ---- Brend qatori ----
    if (!dry) {
      doc.setDrawColor(...LINE);
      doc.setLineDashPattern([3, 3], 0);
      doc.line(MARGIN, y, PAGE_W - MARGIN, y);
      doc.setLineDashPattern([], 0);
    }
    y += 20;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(59, 130, 246);
    text("W", MARGIN, y);
    doc.setTextColor(...INK);
    text("enet", MARGIN + doc.getTextWidth("W"), y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...FAINT);
    text("wenet.uz", PAGE_W - MARGIN, y, { align: "right" });

    return y + 30;
  };

  const pageHeight = render(newDoc(2000, useDejavu), true);
  const doc = newDoc(pageHeight, useDejavu);
  render(doc, false);
  return Buffer.from(doc.output("arraybuffer"));
};

// Telegram'dagi fayl nomi: "chek-Feruza Rahimova-2026-10-08.pdf".
const receiptFileName = (prefix, studentName, paidAt) => {
  const safe = (studentName || "").trim().replace(/[\\/:*?"<>|]+/g, "") || prefix;
  const day = (paidAt ? moment.unix(paidAt) : moment()).tz(TZ).format("YYYY-MM-DD");
  return `${prefix}-${safe}-${day}.pdf`;
};

module.exports = { buildPaymentReceiptPdf, receiptFileName };
