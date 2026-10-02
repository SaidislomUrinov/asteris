const crypto = require("crypto");

// Odam qo'lda yozishi ham mumkin bo'lgan qisqa kod — Crockford base32'ga
// yaqin alifbo: chalkash bo'ladigan harflar (0/O, 1/I/L, U) chiqarib
// tashlangan, faqat katta harflar (QR/URL'da ham bir xil ko'rinadi).
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

const randomCode = (length) => {
  const bytes = crypto.randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i++) code += ALPHABET[bytes[i] % ALPHABET.length];
  return code;
};

// Sertifikat/to'lov kabi PUBLIC (URL/QR'da ko'rinadigan) kodlar uchun —
// `exists(code)` orqali to'qnashuv tekshiriladi va topilsa qayta
// generatsiya qilinadi (bir nechta marta to'qnashish ehtimoli
// ALPHABET^length hajmida astronomik past, shuning uchun kichik chegara
// yetarli — cheksiz sikl xavfi bo'lmasligi uchun).
const generateUniqueShortCode = async (exists, { length = 8, maxAttempts = 10 } = {}) => {
  for (let i = 0; i < maxAttempts; i++) {
    const code = randomCode(length);
    if (!(await exists(code))) return code;
  }
  throw new Error("shortCode.generationFailed");
};

module.exports = { randomCode, generateUniqueShortCode };
