// NoSQL operator injeksiyasidan himoya: body'dagi `$` bilan boshlanuvchi
// kalitlar olib tashlanadi (ichma-ich obyekt/massivlarda ham). Nuqtali
// kalitlarga tegilmaydi — ba'zi formalar `{"excel.export": true}` yuboradi.
//
// Avval `{"centerId":{"$ne":null}}` kabi body `findOne({ _id: centerId })` ga
// to'g'ridan-to'g'ri tushib, operator sifatida bajarilardi — masalan xona
// "birinchi topilgan" filialda yaratilardi (QA 2026-10-02). Hech bir
// endpoint body'da Mongo operatorini kutmaydi, shuning uchun global tozalash
// xavfsiz. `req.query` Express 5'da getter va `qs` operatorlarni obyektga
// aylantirmaydi (QA'da ta'sir qilmagani tasdiqlangan).
const clean = (value, depth = 0) => {
  if (depth > 20 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => clean(v, depth + 1));
  // Buffer/Date/fayl obyektlari (express-fileupload) — tegilmaydi.
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return value;
  for (const key of Object.keys(value)) {
    // `__proto__`/`constructor`/`prototype` — prototype pollution (Object.assign/merge'da).
    if (key.startsWith("$") || key === "__proto__" || key === "constructor" || key === "prototype") delete value[key];
    else value[key] = clean(value[key], depth + 1);
  }
  return value;
};

module.exports = (req, res, next) => {
  if (req.body && typeof req.body === "object") clean(req.body);
  next();
};
