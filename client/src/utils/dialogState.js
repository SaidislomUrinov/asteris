// Hozir ekranda ochiq Dialog bor-yo'qligini bilish uchun eng sodda hisoblagich.
// Redux/Context emas — bu qiymat RENDER uchun kerak emas, faqat hodisa
// paytida (apparat QR skaner keydown tinglovchisi) tekshiriladi, shuning
// uchun oddiy modul o'zgaruvchisi yetarli va hech qanday qayta render
// keltirib chiqarmaydi.
//
// Alohida faylda turadi, chunki `Dialog.jsx` dan komponentdan boshqa narsa
// eksport qilinsa Vite "Fast refresh only works when a file only exports
// components" xatosini beradi (`utils/tabBar.js` bilan bir xil sabab).
let openCount = 0;

export const dialogOpened = () => {
  openCount += 1;
};

export const dialogClosed = () => {
  openCount = Math.max(0, openCount - 1);
};

export const isAnyDialogOpen = () => openCount > 0;
