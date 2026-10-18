// Hodim telefon raqami bilan kirishi (API_CONTRACT_staff_phone.md §1) —
// server ishga tushganda AVTOMATIK (connectDB), idempotent va cluster'da xavfsiz.
//
// Eski `{client, login}` unique indeksining filtri faqat `isDeleted: false` edi:
// login'siz yaratilgan IKKINCHI hodim `login: null` dublikati sifatida E11000
// berardi. Indeks `login: { $type: "string" }` filtri bilan qayta quriladi.
// Ma'lumotga tegilmaydi.
const Staff = require("../models/Staff");

const INDEX_NAME = "client_1_login_1";

const migrateStaffPhone = async () => {
  const col = Staff.collection;
  let indexes = [];
  try {
    indexes = await col.indexes();
  } catch {
    return; // collection hali yo'q — autoIndex to'g'ri indeksni o'zi yaratadi
  }
  const current = indexes.find((i) => i.name === INDEX_NAME);
  if (current && !current.partialFilterExpression?.login) {
    try {
      await col.dropIndex(INDEX_NAME);
    } catch {
      // boshqa worker allaqachon o'chirgan
    }
    console.log("Staff {client, login} indeksi yangi filtr bilan qayta qurildi");
  }
  // Ikkala indeks ham (yangi `{client, phone}` va yangilangan login) — schema
  // bo'yicha. Allaqachon bor bo'lsa hech narsa qilmaydi.
  try {
    await Staff.createIndexes();
  } catch (err) {
    console.error("Staff indekslari:", err.message);
  }
};

module.exports = migrateStaffPhone;
