import { jsPDF } from "jspdf";

// Mijoz yaratilgach uning kirish rekvizitlarini (ism, telefon, parol) chiroyli
// PDF sifatida avtomatik yuklab beradi — parol faqat shu paytda oq-qora ko'rinadi.
export function downloadClientCredentialsPdf({ name, phone, password, clientId }) {
  const doc = new jsPDF({ unit: "pt", format: "a5" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  // Header
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 90, "F");
  doc.setTextColor(16, 185, 129); // emerald-500
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text("A", margin, 55);
  doc.setTextColor(255, 255, 255);
  doc.text("steris", margin + doc.getTextWidth("A"), 55);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Mijoz kirish rekvizitlari", margin, 75);

  // Body card
  let y = 130;
  doc.setTextColor(30, 41, 59); // slate-800
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(`Mijoz #${clientId ?? ""}`, margin, y);

  const rows = [
    ["Ism", name],
    ["Telefon", phone],
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
    "Ushbu hujjatni maxfiy saqlang. Parolni faqat mijozning o'ziga bering.",
    margin,
    y,
    { maxWidth: pageWidth - margin * 2 },
  );

  doc.save(`mijoz-${clientId ?? "yangi"}-rekvizitlar.pdf`);
}
