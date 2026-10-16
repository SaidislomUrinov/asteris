import { loadJsPdf, loadQRCode } from "../../utils/lazyLibs";

const RECEIPT_VERIFY_BASE = "https://wenet.uz/payment/verify";

function formatMonth(forMonth, monthNames) {
  if (!forMonth) return "—";
  const [year, month] = forMonth.split("-").map(Number);
  if (!year || !month) return forMonth;
  return `${monthNames[month - 1] || ""} ${year}`;
}

// "2026-04" -> "04-2026" — qarzdorlik ro'yxatidagi qisqa, bir xil kenglikdagi
// oy belgisi (oy nomi bilan yozilsa qatorlar tekislanmay ketardi).
function monthCode(forMonth) {
  if (!forMonth) return "—";
  const [year, month] = String(forMonth).split("-");
  if (!year || !month) return String(forMonth);
  return `${month}-${year}`;
}

function formatSum(n, somSuffix) {
  return `${Number(n || 0).toLocaleString("uz-UZ")} ${somSuffix}`;
}

// Chetdagi tishli (perforatsiya) chiziq — chek ikki qismga "yirtilgandek"
// ko'rinishi uchun, chap va o'ng chetlarida yarim doira "kesik"lar bilan.
function drawPerforation(doc, y, pageWidth) {
  doc.setFillColor(255, 255, 255);
  doc.circle(0, y, 10, "F");
  doc.circle(pageWidth, y, 10, "F");
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(1);
  doc.setLineDashPattern([4, 3], 0);
  doc.line(16, y, pageWidth - 16, y);
  doc.setLineDashPattern([], 0);
}

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

// To'lovdan keyin ochiladigan "Chek yuklansinmi?" modalidagi "Yuklash"
// tugmasi shu funksiyani chaqiradi.
//
// Dizayn ("summa birinchi", 2026-09-21): tepada markazda katta yashil
// to'langan summa, tishli ajratuvchi, pastda kalit–qiymat qatorlari
// (O'quvchi / Guruh / Filial), qarzdorlik qutisi, QR va brend. Filial, guruh
// va o'quvchi nomlari HAR QANDAY uzunlikda bo'lishi mumkin — ular chap
// ustunda label bilan yonma-yon, `splitTextToSize` orqali bir necha qatorga
// o'raladi, hech narsa ustma-ust tushmaydi. Chek balandligi shunga qarab
// o'sadi: jsPDF'da sahifa formati keyin o'zgarmagani uchun avval "quruq"
// o'tishda balandlik o'lchanadi, keyin haqiqiy hujjat chiziladi.
//
// `t` — chaqiruvchi komponentdan (useTranslation) uzatiladi, chunki bu
// oddiy util funksiya, React komponent emas — ko'p tillik tizimga moslash
// uchun barcha matnlar shu orqali tarjima qilinadi (wenet.uz brend nomi
// bundan mustasno — u tarjima qilinmaydi).
export async function downloadPaymentReceiptPdf(
  {
    centerName,
    groupLabel,
    studentName,
    phone,
    amount,
    remainingDebt,
    // [{ kind: "opening"|"cycle", month: "2026-04"|null, debt: 350000 }] — qarzi bor HAR BIR oy.
    // Backend `student.service.js` → `computeBilling().debtBreakdown`
    // (API_CONTRACT_receipt_debt_breakdown.md). Berilmasa chek eskicha,
    // faqat jami summa bilan chiqadi.
    debtBreakdown = [],
    forMonth,
    paymentId,
  },
  t,
) {
  const [jsPDF, QRCode] = await Promise.all([loadJsPdf(), loadQRCode()]);
  const monthNames = t("common.monthNames", { returnObjects: true });
  const somSuffix = t("student.somSuffix");
  const hasDebt = remainingDebt > 0;

  const allDebtRows = (debtBreakdown || []).filter((r) => r?.debt > 0);
  const debtRows = allDebtRows.slice(0, MAX_DEBT_ROWS);
  const hiddenRowCount = allDebtRows.length - debtRows.length;

  const qrValue = paymentId ? `${RECEIPT_VERIFY_BASE}/${paymentId}` : RECEIPT_VERIFY_BASE;
  const qrDataUrl = await QRCode.toDataURL(qrValue, {
    margin: 0,
    width: 256,
    color: { dark: "#0f172a", light: "#ffffff" },
  });

  const dateStr = new Date().toLocaleString("uz-UZ");
  const contentW = PAGE_W - MARGIN * 2;

  // Kalit–qiymat qatorlari: label ustuni sobit, qiymat qolgan kenglikni
  // oladi va kerak bo'lsa o'raladi.
  const KV_LABEL_W = 62;
  const kvValueW = contentW - KV_LABEL_W;
  const kvRows = [
    {
      label: t("student.receiptStudentLabel"),
      value: studentName || "—",
      sub: phone || "",
    },
    { label: t("student.receiptGroupLabel"), value: groupLabel || "—" },
    { label: t("student.receiptCenterLabel"), value: centerName || "—" },
  ];

  // `dry` — faqat balandlikni o'lchash; chizmaydi.
  const render = (doc, dry) => {
    const text = (...args) => {
      if (!dry) doc.text(...args);
    };
    let y = 38;

    // ---- Summa (hero) ----
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...FAINT);
    text(t("student.receiptPaidLabel").toUpperCase(), PAGE_W / 2, y, { align: "center" });
    y += 26;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.setTextColor(...GREEN);
    text(formatSum(amount, somSuffix), PAGE_W / 2, y, { align: "center", maxWidth: contentW });
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED);
    text(`${formatMonth(forMonth, monthNames)}  ·  ${dateStr}`, PAGE_W / 2, y, {
      align: "center",
      maxWidth: contentW,
    });

    y += 24;
    if (!dry) drawPerforation(doc, y, PAGE_W);
    y += 30;

    // ---- Kalit–qiymat ----
    for (const row of kvRows) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      const lines = doc.splitTextToSize(String(row.value), kvValueW);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...FAINT);
      text(row.label.toUpperCase(), MARGIN, y);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...INK);
      text(lines, MARGIN + KV_LABEL_W, y);
      y += lines.length * 13;

      if (row.sub) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(...MUTED);
        text(row.sub, MARGIN + KV_LABEL_W, y);
        y += 12;
      }
      y += 8;
    }

    y += 8;

    // ---- Qarzdorlik qutisi ----
    const boxH = debtRows.length
      ? 26 + debtRows.length * DEBT_ROW_H + (hiddenRowCount > 0 ? DEBT_ROW_H : 0) + 22
      : 40;
    const boxRight = MARGIN + contentW - 10;
    if (!dry) {
      doc.setDrawColor(...LINE);
      doc.setLineWidth(1);
      doc.roundedRect(MARGIN, y, contentW, boxH, 4, 4, "S");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...FAINT);
    text(t("student.receiptDebtLabel").toUpperCase(), MARGIN + 10, y + 14);

    if (debtRows.length) {
      let rowY = y + 30;
      doc.setFontSize(10);
      for (const row of debtRows) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(51, 65, 85);
        // Ko'chirishdan oldingi (boshlang'ich) qarz — belgisi bilan, oyi
        // noma'lum bo'lsa "Oyi ko'rsatilmagan" (API_CONTRACT_opening_debts.md §4).
        const rowLabel =
          row.kind === "opening"
            ? `${row.month ? monthCode(row.month) : t("student.openingMonthUnknown")} - ${t("student.openingBadge")}`
            : monthCode(row.month);
        text(rowLabel, MARGIN + 10, rowY, { maxWidth: contentW - 110 });
        doc.setTextColor(...RED);
        text(formatSum(row.debt, somSuffix), boxRight, rowY, { align: "right" });
        rowY += DEBT_ROW_H;
      }
      if (hiddenRowCount > 0) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...FAINT);
        text(t("student.receiptDebtMoreMonths", { count: hiddenRowCount }), MARGIN + 10, rowY);
        rowY += DEBT_ROW_H;
      }
      if (!dry) {
        doc.setDrawColor(...LINE);
        doc.line(MARGIN + 10, rowY - 6, boxRight, rowY - 6);
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...FAINT);
      text(t("student.receiptDebtTotalLabel").toUpperCase(), MARGIN + 10, rowY + 8);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...RED);
      text(formatSum(remainingDebt, somSuffix), boxRight, rowY + 8, { align: "right" });
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(...(hasDebt ? RED : MUTED));
      text(hasDebt ? formatSum(remainingDebt, somSuffix) : t("student.noDebt"), MARGIN + 10, y + 30);
    }
    y += boxH + 26;

    // ---- QR (markazda) ----
    if (!dry) doc.addImage(qrDataUrl, "PNG", (PAGE_W - QR_SIZE) / 2, y, QR_SIZE, QR_SIZE);
    y += QR_SIZE + 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...FAINT);
    const hintLines = doc.splitTextToSize(t("student.receiptVerifyHint"), contentW - 40);
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

  // 1-o'tish: balandlik. 2-o'tish: haqiqiy chizish.
  const pageHeight = render(new jsPDF({ unit: "pt", format: [PAGE_W, 2000] }), true);
  const doc = new jsPDF({ unit: "pt", format: [PAGE_W, pageHeight] });
  render(doc, false);

  const safeName = (studentName || "chek").trim().replace(/[\\/:*?"<>|]+/g, "");
  doc.save(`chek-${safeName}.pdf`);
}
