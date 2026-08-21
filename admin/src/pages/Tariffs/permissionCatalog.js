// server/src/models/Tariff.js dagi allowedPermissions enum ro'yxatiga mos —
// bular tarif orqali ochiladigan premium funksiyalar (feature flag), CRUD
// permission emas. Har modul ichida bir nechta feature bo'lishi mumkin.
export const PERMISSION_CATALOG = [
  {
    module: "excel",
    label: "Excel",
    items: [
      {
        key: "excel.export",
        label: "Excel export",
        description:
          "O'quvchilar, to'lovlar va boshqa ro'yxatlarni Excel (.xlsx) faylga yuklab olish imkonini beradi.",
      },
    ],
  },
  {
    module: "telegram",
    label: "Telegram",
    items: [
      {
        key: "telegram.notifications",
        label: "Xabarnomalar",
        description:
          "Telegram bot orqali muhim voqealar (to'lov, davomat va h.k.) haqida avtomatik xabar yuboradi.",
      },
    ],
  },
  {
    module: "teacher",
    label: "O'qituvchi",
    items: [
      {
        key: "teacher.notifications",
        label: "Bildirishnomalar",
        description: "O'qituvchilarga darslar va vazifalar haqida ilova ichida bildirishnoma yuboradi.",
      },
      {
        key: "teacher.performance",
        label: "Ish unumdorligi",
        description: "O'qituvchining o'quvchilar natijalariga asoslangan samaradorlik statistikasini ko'rsatadi.",
      },
    ],
  },
  {
    // Ish haqi — Menejer/Resepshin/O'qituvchi barchasiga tegishli (masalan
    // o'quvchi to'lovidan foiz: o'qituvchiga, resepshinga, menejerga alohida
    // ulush, qolgani markaz foydasi bo'lishi mumkin) — shuning uchun alohida,
    // rolga bog'liq bo'lmagan modul.
    module: "salary",
    label: "Ish haqi",
    items: [
      {
        key: "staff.salary.advance",
        label: "Avans berish",
        description: "Hodimga oy davomida avans (oldindan) to'lov berish imkoniyatini ochadi.",
      },
      {
        key: "staff.salary.percentage",
        label: "Foizli oylik",
        description: "Hodim maoshini o'quvchi to'lovlaridan foiz sifatida avtomatik hisoblaydi.",
      },
      {
        key: "staff.salary.fixed",
        label: "Qat'iy oylik",
        description: "Hodimga har oy o'zgarmas, belgilangan summa oylik hisoblanadi.",
      },
      {
        key: "staff.salary.perGroup",
        label: "Guruh bo'yicha oylik",
        description: "Har bir guruh uchun alohida oylik stavkasi belgilash imkonini beradi.",
      },
      {
        key: "staff.bonus",
        label: "Bonus",
        description: "Hodimga qo'shimcha bonus va rag'batlantirish summalarini qo'shish imkonini beradi.",
      },
    ],
  },
  {
    module: "student",
    label: "O'quvchi",
    items: [
      {
        key: "student.rate",
        label: "Baholash",
        description: "O'quvchilarni dars davomida baholash va reyting yuritish imkonini beradi.",
      },
      {
        key: "student.transfer",
        label: "Guruh almashtirish",
        description: "O'quvchini bir guruhdan boshqasiga ko'chirish imkonini beradi.",
      },
    ],
  },
  {
    module: "attendance",
    label: "Davomat",
    items: [
      {
        key: "attendance.qr",
        label: "QR davomat",
        description: "Davomatni QR kod skanerlash orqali avtomatik belgilash imkonini beradi.",
      },
      {
        key: "attendance.report",
        label: "Davomat hisobotlari",
        description: "Davomat bo'yicha batafsil statistik hisobotlar yaratadi.",
      },
    ],
  },
  {
    module: "room",
    label: "Xona",
    items: [
      {
        key: "room.control",
        label: "Xonalarni boshqarish",
        description: "Xona va auditoriyalarni band qilish, band holatini kuzatish imkonini beradi.",
      },
    ],
  },
  {
    module: "lesson",
    label: "Dars",
    items: [
      {
        key: "lesson.planning",
        label: "Dars rejalashtirish",
        description: "Kelgusi darslar jadvalini oldindan rejalashtirish imkonini beradi.",
      },
    ],
  },
  {
    module: "homework",
    label: "Uy vazifasi",
    items: [
      {
        key: "homework.manage",
        label: "Uy vazifasi",
        description: "O'quvchilarga uy vazifasi berish va uni tekshirish imkonini beradi.",
      },
    ],
  },
  {
    module: "certificate",
    label: "Sertifikat",
    items: [
      {
        key: "certificate.manage",
        label: "Sertifikat",
        description: "Kursni tugatgan o'quvchilarga sertifikat yaratish va berish imkonini beradi.",
      },
    ],
  },
  {
    module: "receipt",
    label: "Chek",
    items: [
      {
        key: "receipt.manage",
        label: "To'lov cheki",
        description: "To'lov qabul qilinganda rasmiy chek yaratish va chop etish imkonini beradi.",
      },
    ],
  },
  {
    module: "finance",
    label: "Moliya",
    items: [
      {
        key: "finance.expense",
        label: "Xarajatlar",
        description: "Markaz xarajatlarini qayd qilish va kuzatish imkonini beradi.",
      },
      {
        key: "finance.refund",
        label: "Qaytarish",
        description: "O'quvchiga to'langan pulni qaytarish (refund) imkonini beradi.",
      },
      {
        key: "finance.report",
        label: "Moliyaviy hisobot",
        description: "Daromad va xarajatlar bo'yicha umumiy moliyaviy hisobot yaratadi.",
      },
    ],
  },
  {
    module: "ai",
    label: "AI",
    items: [
      {
        key: "ai.report",
        label: "AI hisobot",
        description: "Sun'iy intellekt yordamida avtomatik tahliliy hisobotlar yaratadi.",
      },
      {
        key: "ai.advice",
        label: "AI tavsiya",
        description: "Sun'iy intellekt asosida markazni yaxshilash bo'yicha tavsiyalar beradi.",
      },
    ],
  },
];

export const ALL_PERMISSIONS = PERMISSION_CATALOG.flatMap((m) => m.items.map((i) => i.key));
