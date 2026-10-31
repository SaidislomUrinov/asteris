// SMS qism (segment) hisobi. Faqat ASCII (Lotin) bo'lsa 160/153, aks holda (kirill,
// `ʻ` va h.k. — UCS-2) 70/67. Bo'sh matn ham kamida 1 qism.
const ASCII_ONLY = /^[\x00-\x7F]*$/;

const countSegments = (text) => {
  const str = String(text ?? "");
  const len = str.length;
  if (ASCII_ONLY.test(str)) return len <= 160 ? 1 : Math.ceil(len / 153);
  return len <= 70 ? 1 : Math.ceil(len / 67);
};

module.exports = { countSegments };
