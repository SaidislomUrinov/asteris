import { jsPDF } from "jspdf";
import QRCode from "qrcode";

const RECEIPT_VERIFY_BASE = "https://aseteris.uz/payment/info";

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

// To'lovdan keyin ochiladigan "Chek yuklansinmi?" modalidagi "Yuklash"
// tugmasi shu funksiyani chaqiradi. Dizayn — boarding-pass/chipta uslubidagi
// namuna (receipt example.png) asosida: yuqorida markaz/guruh "yo'nalishi",
// tishli (perforatsiya) ajratuvchi chiziq, pastda o'quvchi ma'lumotlari va
// QR kod (chekni https://aseteris.uz/payment/info/:paymentId orqali
// tekshirish uchun).
//
// `t` — chaqiruvchi komponentdan (useTranslation) uzatiladi, chunki bu
// oddiy util funksiya, React komponent emas — ko'p tillik tizimga moslash
// uchun barcha matnlar shu orqali tarjima qilinadi (asteris.uz brend nomi
// bundan mustasno — u tarjima qilinmaydi).
export async function downloadPaymentReceiptPdf(
  {
    centerName,
    groupLabel,
    studentName,
    phone,
    amount,
    remainingDebt,
    // [{ month: "2026-04", debt: 350000 }] — qarzi bor HAR BIR oy.
    // Backend `student.service.js` → `computeBilling().debtBreakdown`
    // (API_CONTRACT_receipt_debt_breakdown.md). Berilmasa chek eskicha,
    // faqat jami summa bilan chiqadi.
    debtBreakdown = [],
    forMonth,
    paymentId,
  },
  t,
) {
  const monthNames = t("common.monthNames", { returnObjects: true });
  const somSuffix = t("student.somSuffix");
  const hasDebt = remainingDebt > 0;

  // Chekka sig'adigan qatorlar soni cheklangan — undan ortig'i "va yana N oy"
  // qatoriga yig'iladi, aks holda chek cheksiz cho'zilib ketardi.
  const MAX_DEBT_ROWS = 8;
  const allDebtRows = (debtBreakdown || []).filter((r) => r?.debt > 0);
  const debtRows = allDebtRows.slice(0, MAX_DEBT_ROWS);
  const hiddenRowCount = allDebtRows.length - debtRows.length;

  // Qarzdorlik qutisi balandligi qatorlar soniga qarab o'sadi, sahifa
  // formati esa shunga mos ravishda cho'ziladi (jsPDF'da format hujjat
  // yaratilgandan keyin o'zgarmaydi, shuning uchun oldindan hisoblanadi).
  const DEBT_ROW_H = 15;
  const debtBoxH = debtRows.length
    ? 26 + debtRows.length * DEBT_ROW_H + (hiddenRowCount > 0 ? DEBT_ROW_H : 0) + 22
    : 40;
  const pageHeight = 400 + Math.max(0, debtBoxH - 40);

  const doc = new jsPDF({ unit: "pt", format: [320, pageHeight] });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 26;
  const qrSize = 64;
  const leftWidth = pageWidth - margin * 2 - qrSize - 14;

  // Chap tomondagi rang chizig'i — qarz bo'lsa qizil, bo'lmasa yashil
  const accent = hasDebt ? [239, 68, 68] : [16, 185, 129];
  doc.setFillColor(...accent);
  doc.rect(0, 0, 6, 150, "F");

  // Sarlavha — markaz va guruh "yo'nalish" ko'rinishida
  let y = 40;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(15, 23, 42);
  doc.text(centerName || "—", margin, y);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text(t("student.receiptCenterLabel").toUpperCase(), margin, y + 13);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(15, 23, 42);
  doc.text(groupLabel || "—", pageWidth - margin, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(t("student.receiptGroupLabel").toUpperCase(), pageWidth - margin, y + 13, {
    align: "right",
  });

  y += 34;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  const now = new Date();
  doc.text(now.toLocaleString("uz-UZ"), margin, y);

  y += 26;
  drawPerforation(doc, y, pageWidth);
  y += 34;

  // O'quvchi
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text(t("student.receiptStudentLabel").toUpperCase(), margin, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(studentName || "", margin, y + 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(100, 116, 139);
  doc.text(phone || "", margin, y + 30);

  // QR kod — chekni tekshirish uchun (yuqori o'ng, https://aseteris.uz/payment/info/:paymentId)
  const qrValue = paymentId
    ? `${RECEIPT_VERIFY_BASE}/${paymentId}`
    : RECEIPT_VERIFY_BASE;
  const qrDataUrl = await QRCode.toDataURL(qrValue, {
    margin: 0,
    width: 256,
    color: { dark: "#0f172a", light: "#ffffff" },
  });
  doc.addImage(qrDataUrl, "PNG", pageWidth - margin - qrSize, y - 6, qrSize, qrSize);

  y += 56;

  // Chapdagi ustunga (QR maydonini bosib o'tmaydigan kenglikda) summa/oy
  const cols = [
    { label: t("student.receiptAmountLabel"), value: formatSum(amount, somSuffix), color: [16, 150, 90] },
    { label: t("student.receiptMonthLabel"), value: formatMonth(forMonth, monthNames), color: [30, 41, 59] },
  ];
  const colWidth = leftWidth / 2;
  cols.forEach((col, i) => {
    const x = margin + i * colWidth;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(col.label.toUpperCase(), x, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...col.color);
    doc.text(String(col.value), x, y + 16, { maxWidth: colWidth - 6 });
  });

  y += 46;

  // Qarzdorlik — "SEAT" uslubidagi ramkali quti. Qarzi bor oylar bo'lsa
  // quti kengayadi va har bir oy alohida qator bo'lib chiqadi
  // ("04-2026 ....... 350,000 so'm"), oxirida jami.
  const boxW = debtRows.length ? pageWidth - margin * 2 : 140;
  const boxH = debtBoxH;
  const boxRight = margin + boxW - 10;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(1);
  doc.roundedRect(margin, y, boxW, boxH, 4, 4, "S");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(t("student.receiptDebtLabel").toUpperCase(), margin + 10, y + 14);

  if (debtRows.length) {
    let rowY = y + 30;
    doc.setFontSize(10);
    debtRows.forEach((row) => {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(51, 65, 85);
      doc.text(monthCode(row.month), margin + 10, rowY);
      doc.setTextColor(220, 38, 38);
      doc.text(formatSum(row.debt, somSuffix), boxRight, rowY, { align: "right" });
      rowY += DEBT_ROW_H;
    });

    if (hiddenRowCount > 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text(t("student.receiptDebtMoreMonths", { count: hiddenRowCount }), margin + 10, rowY);
      rowY += DEBT_ROW_H;
    }

    // Jami qatori — ustidagi ingichka ajratuvchi chiziq bilan
    doc.setDrawColor(226, 232, 240);
    doc.line(margin + 10, rowY - 6, boxRight, rowY - 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(t("student.receiptDebtTotalLabel").toUpperCase(), margin + 10, rowY + 8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(220, 38, 38);
    doc.text(formatSum(remainingDebt, somSuffix), boxRight, rowY + 8, { align: "right" });
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...(hasDebt ? [220, 38, 38] : [100, 116, 139]));
    doc.text(
      hasDebt ? formatSum(remainingDebt, somSuffix) : t("student.noDebt"),
      margin + 10,
      y + 30,
    );
  }

  y += boxH + 34;

  // Pastki brend qatori
  doc.setDrawColor(226, 232, 240);
  doc.setLineDashPattern([3, 3], 0);
  doc.line(margin, y, pageWidth - margin, y);
  doc.setLineDashPattern([], 0);

  y += 22;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(59, 130, 246);
  doc.text("A", margin, y);
  doc.setTextColor(15, 23, 42);
  doc.text("steris", margin + doc.getTextWidth("A"), y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text("asteris.uz", pageWidth - margin, y, { align: "right" });

  const safeName = (studentName || "chek").trim().replace(/[\\/:*?"<>|]+/g, "");
  doc.save(`chek-${safeName}.pdf`);
}
