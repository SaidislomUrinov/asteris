// Og'ir kutubxonalar (jspdf ≈330 KB, qrcode, read-excel-file) asosiy bundle'ga
// kirmaydi — faqat foydalanuvchi PDF/QR/import amalini bosganda yuklanadi.
// Bir marta yuklangach brauzer modulni keshlaydi, keyingi chaqiruvlar darhol.
export const loadJsPdf = async () => (await import("jspdf")).jsPDF;
export const loadQRCode = async () => (await import("qrcode")).default;
export const loadReadXlsx = async () => (await import("read-excel-file/browser")).default;
