// Migratsiya: "manager" roli olib tashlandi.
//
// Manager'ning to'liq huquqi ROL orqali berilardi (middleware'da
// `role === "manager"` implicit ruxsat edi). Endi to'liq huquq faqat
// RUXSAT orqali: `permissions: ["all"]`. Shuning uchun mavjud manager'lar
// `reception` roliga o'tkaziladi va ularga `["all"]` beriladi — huquqlari
// aynan avvalgidek qoladi.
//
// Ishlatish: node scripts/migrate-manager-role.js
require("dotenv").config();
const mongoose = require("mongoose");
const Staff = require("../src/models/Staff");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  // `role` enum'idan "manager" olib tashlangani uchun mongoose validatsiyasi
  // aralashmasin — to'g'ridan-to'g'ri collection orqali.
  const col = mongoose.connection.collection("staffs");
  const managers = await col.find({ role: "manager" }).toArray();

  console.log(`Topildi: ${managers.length} ta manager`);
  for (const m of managers) {
    const permissions = m.permissions?.includes("all") ? m.permissions : ["all"];
    await col.updateOne({ _id: m._id }, { $set: { role: "reception", permissions } });
    console.log(`  ✓ ${m.name} (${m.login}) → reception + ["all"]`);
  }

  console.log("Tugadi.");
  await mongoose.disconnect();
  process.exit(0);
})().catch((error) => {
  console.error("XATO:", error.message);
  process.exit(1);
});
