import { jsPDF } from "jspdf";

// Hodim yaratilgach uning kirish rekvizitlarini (ism, login, parol) chiroyli
// PDF sifatida avtomatik yuklab beradi — parol faqat shu paytda oq-qora
// ko'rinadi (bir martalik). admin/src/pages/Clients/pdf.util.js bilan bir
// xil vizual naqsh (alohida ilova bo'lgani uchun bu yerda takrorlanadi).
export function downloadStaffCredentialsPdf({ name, login, password }) {
  const doc = new jsPDF({ unit: "pt", format: "a5" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  // Header
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 90, "F");
  doc.setTextColor(59, 130, 246); // blue-500
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text("A", margin, 55);
  doc.setTextColor(255, 255, 255);
  doc.text("steris", margin + doc.getTextWidth("A"), 55);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Hodim kirish rekvizitlari", margin, 75);

  // Body card
  let y = 130;
  doc.setTextColor(30, 41, 59); // slate-800
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(name || "", margin, y);

  const rows = [
    ["Login", login],
    ["Parol", password],
  ];

  y += 25;
  const rowHeight = 46;
  rows.forEach(([label, value]) => {
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.roundedRect(margin, y, pageWidth - margin * 2, rowHeight - 10, 8, 8, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(label.toUpperCase(), margin + 14, y + 15);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(String(value ?? ""), margin + 14, y + 30);

    y += rowHeight;
  });

  y += 20;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(
    "Ushbu hujjatni maxfiy saqlang. Parolni faqat hodimning o'ziga bering.",
    margin,
    y,
    { maxWidth: pageWidth - margin * 2 },
  );

  const safeName = (name || "hodim").trim().replace(/[\\/:*?"<>|]+/g, "");
  doc.save(`${safeName}.pdf`);
}
