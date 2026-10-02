// Moliyaviy qiymatlarni formatlash — `hidden` bo'lsa haqiqiy son o'rniga
// SONNING UZUNLIGIGA BOG'LIQ BO'LMAGAN qat'iy niqob qaytariladi (uzunlik
// o'zi ham summa haqida maylumot bermasligi uchun blur emas, aynan shu
// qatiy belgi ishlatiladi).
const MASK = "****";

export const maskMoney = (value, hidden) =>
  hidden ? MASK : `${(value || 0).toLocaleString("uz-UZ")}`;
