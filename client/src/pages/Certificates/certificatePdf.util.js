import { loadJsPdf, loadQRCode } from "../../utils/lazyLibs";

const VERIFY_BASE = "https://wenet.uz/certificate/verify";

// TemplateEditor.jsx'dagi konstruktor canvas'ining nominal o'lchami
// (`PAGE_WIDTH`=880, konteyner `aspect-[1.4/1]`) — fon rasm shu quti ichida
// `object-cover` bilan ko'rsatiladi (kattaroq nisbatga qarab kesiladi).
// `field.fontSize`/QR o'lchami SHU quti bo'yicha CSS px sifatida tanlanadi.
const EDITOR_CANVAS_WIDTH = 880;
const EDITOR_CANVAS_HEIGHT = EDITOR_CANVAS_WIDTH / 1.4;

// Rasmni fetch qilib base64 (data URL) ga aylantiradi — jsPDF `addImage`
// sinxron chaqiriladigan hujjat generatsiyasidan OLDIN rasm to'liq
// xotirada bo'lishini talab qiladi, oddiy `<img src>` yetarli emas.
async function toDataUrl(url) {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// jsPDF `addFileToVFS` "data:...;base64," prefiksisiz, XOM base64 kutadi.
async function toBase64(url) {
  const dataUrl = await toDataUrl(url);
  return dataUrl.split(",")[1] || "";
}

function imageSize(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.src = dataUrl;
  });
}

/**
 * Shablonda ishlatilgan har bir NOYOB shrift faylini bir marta yuklab,
 * jsPDF hujjatiga o'rnatadi (`addFileToVFS` + `addFont`) — shundan keyin
 * `doc.setFont(family)` shu shrift bilan chizadi. `family` — `Font.family`
 * qiymati (masalan "font-6a..."), fayl kengaytmasi saqlanmaganligi uchun
 * har doim ".ttf" deb yozamiz (jsPDF nomga qarab format aniqlamaydi,
 * ichki base64 kontent muhim).
 *
 * @param {Object} doc - jsPDF hujjati
 * @param {Array} fields - shablon maydonlari
 * @param {Array} fonts - `GET /fonts` javobi: [{ family, fileUrl }]
 * @param {string} baseUrl - `${API}` prefiksi
 */
async function embedFonts(doc, fields, fonts, baseUrl) {
  const families = [...new Set(fields.map((f) => f.fontFamily).filter(Boolean))];
  const fontByFamily = Object.fromEntries((fonts || []).map((f) => [f.family, f]));

  for (const family of families) {
    const font = fontByFamily[family];
    if (!font) continue;
    try {
      const base64 = await toBase64(`${baseUrl}${font.fileUrl}`);
      const fileName = `${family}.ttf`;
      doc.addFileToVFS(fileName, base64);
      doc.addFont(fileName, family, "normal");
    } catch {
      // shrift o'rnatilmasa shu maydon standart shriftga qaytadi (pastda)
    }
  }
}

/**
 * Sertifikat PDF'ini shablon + berilgan hujjat (`certificate.service.js`
 * DTO'si) asosida client-side generatsiya qiladi va yuklab beradi — PDF
 * fayl serverda saqlanmaydi (receiptPdf.util.js bilan bir xil falsafa).
 *
 * @param {Object} template - CertificateTemplate DTO (`backgroundUrl`, `fields`)
 * @param {Object} certificate - Certificate DTO (`studentName`, `subjectName`, `groupName`, `date`, `code`)
 * @param {string} backgroundBaseUrl - `${API}` prefiksi (backgroundUrl nisbiy)
 * @param {Array} [fonts] - `GET /fonts` javobi — har bir maydon o'z shriftini
 *   shu ro'yxatdan topadi (`field.fontFamily`), berilmasa standart shrift ishlatiladi.
 */
export async function downloadCertificatePdf(template, certificate, backgroundBaseUrl, fonts = []) {
  const [jsPDF, QRCode] = await Promise.all([loadJsPdf(), loadQRCode()]);
  const bgDataUrl = await toDataUrl(`${backgroundBaseUrl}${template.backgroundUrl}`);
  const { width: imgW, height: imgH } = await imageSize(bgDataUrl);

  const doc = new jsPDF({
    unit: "px",
    format: [imgW, imgH],
    orientation: imgW >= imgH ? "landscape" : "portrait",
  });
  doc.addImage(bgDataUrl, "PNG", 0, 0, imgW, imgH);

  await embedFonts(doc, template.fields || [], fonts, backgroundBaseUrl);

  // Konstruktorda fon rasm `object-cover` bilan ko'rsatiladi — quti (880 x
  // 628.57)ni TO'LDIRISH uchun rasm ikkala o'qda BIR XIL koeffitsientga
  // (ikkalasining KATTASI, "cover") kattalashtiriladi, keyin ortig'i
  // kesiladi. PDF esa rasmni ORIGINAL (kesilmagan) o'lchamda chizadi — shu
  // sabab teskari (eng KICHIK nisbat) koeffitsient qo'llanadi, aks holda
  // element (masalan QR) konstruktordagidan kattaroq/kichikroq chiqadi.
  const coverScale = Math.max(EDITOR_CANVAS_WIDTH / imgW, EDITOR_CANVAS_HEIGHT / imgH);
  const scale = 1 / coverScale;

  const textOf = {
    studentName: certificate.studentName,
    subjectName: certificate.subjectName,
    groupName: certificate.groupName,
    date: certificate.date,
  };

  for (const field of template.fields || []) {
    const x = (field.xPct / 100) * imgW;
    const y = (field.yPct / 100) * imgH;

    if (field.key === "qr") {
      const qrDataUrl = await QRCode.toDataURL(`${VERIFY_BASE}/${certificate.code}`, {
        margin: 0,
        width: 256,
        color: { dark: "#0f172a", light: "#ffffff" },
      });
      const size = (field.fontSize || 90) * scale;
      doc.addImage(qrDataUrl, "PNG", x - size / 2, y - size / 2, size, size);
      continue;
    }

    // Maxsus shrift o'rnatilgan bo'lsa o'shani, aks holda standart
    // "helvetica bold"ni ishlatamiz (o'rnatilgan shrift odatda faqat
    // "normal" og'irlikda keladi, shuning uchun ikkalasi bir xil emas).
    if (field.fontFamily) doc.setFont(field.fontFamily, "normal");
    else doc.setFont("helvetica", "bold");
    // Konstruktorda matn `fontSize/2` CSS px sifatida ko'rsatiladi
    // (TemplateEditor.jsx) — bu yerda ham xuddi shu formuladan foydalanamiz,
    // so'ng haqiqiy rasm kengligiga moslab `scale`ga ko'paytiramiz.
    doc.setFontSize(((field.fontSize || 24) / 2) * scale);
    doc.setTextColor(field.color || "#0f172a");
    const text = field.key === "text" ? field.content || "" : textOf[field.key] || "";
    // Konstruktorda matn CSS orqali `y` bo'yicha VIZUAL MARKAZlanadi
    // (-translate-y-1/2) — jsPDF standart holatda `y`ni birinchi qatorning
    // BASELINE'i deb oladi (harflar `y`dan YUQORIDA, faqat descender
    // pastda), bu konstruktordagi ko'rinishdan sezilarli farq qilar edi.
    // `baseline: "middle"` birinchi qatorni haqiqatan ham `y` atrofida
    // markazlaydi; ko'p qatorli matn uchun BUTUN blokni markazlash uchun
    // qolgan qatorlar soniga qarab qo'shimcha yuqoriga surish saqlanadi.
    const lineCount = text.split("\n").length;
    const lineHeight = doc.getLineHeight() / doc.internal.scaleFactor;
    const startY = y - ((lineCount - 1) * lineHeight) / 2;
    doc.text(text, x, startY, { align: field.align || "center", baseline: "middle" });
  }

  const safeName = (certificate.studentName || "sertifikat").trim().replace(/[\\/:*?"<>|]+/g, "");
  doc.save(`sertifikat-${safeName}.pdf`);
}
