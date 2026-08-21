// server/src/models/Tariff.js dagi allowedPermissions enum'iga mos qisqa
// label'lar — admin/src/pages/Tariffs/permissionCatalog.js bilan bir xil matn
// (ikkala ilova alohida build bo'lgani uchun import qilib bo'lmaydi, shu
// sabab shu yerda takrorlanadi — Tariff modeliga yangi permission qo'shilsa
// ikkalasi ham yangilanishi kerak).
export const PERMISSION_LABELS = {
  "excel.export": "Excel export",
  "telegram.notifications": "Telegram xabarnomalari",
  "teacher.notifications": "O'qituvchi bildirishnomalari",
  "teacher.performance": "Ish unumdorligi",
  "staff.salary.advance": "Avans berish",
  "staff.salary.percentage": "Foizli oylik",
  "staff.salary.fixed": "Qat'iy oylik",
  "staff.salary.perGroup": "Guruh bo'yicha oylik",
  "staff.bonus": "Bonus",
  "student.rate": "Baholash",
  "student.transfer": "Guruh almashtirish",
  "attendance.qr": "QR davomat",
  "attendance.report": "Davomat hisobotlari",
  "room.control": "Xonalarni boshqarish",
  "lesson.planning": "Dars rejalashtirish",
  "homework.manage": "Uy vazifasi",
  "certificate.manage": "Sertifikat",
  "receipt.manage": "To'lov cheki",
  "finance.expense": "Xarajatlar",
  "finance.refund": "Qaytarish",
  "finance.report": "Moliyaviy hisobot",
  "ai.report": "AI hisobot",
  "ai.advice": "AI tavsiya",
};

export const AI_PERMISSIONS = ["ai.report", "ai.advice"];
