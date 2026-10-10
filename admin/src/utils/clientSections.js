// Client ilovasi bo'limlari — YAGONA katalog (2026-10-08 soddalashtirilgan
// menyu bo'yicha guruhlangan). Ikki joy shundan oladi:
//  - Video darsliklar: `key` = TutorialVideo.sectionKey — client'dagi
//    `utils/navSections.js` `resolveSectionKey` bilan bir xil (yo'l "/" siz).
//    Client "?" menyusi joriy sahifaga mos videoni shu kalit bo'yicha topadi.
//  - Yangilik resurslari ("Ichki sahifa"): `path` = "/" + key.
// Client'da yangi sahifa (NAV_SECTIONS) qo'shilsa — shu yerga ham qo'shiladi.
// `*/detail` kalitlari — detail sahifalarning alohida videosi (client
// `resolveSectionKey` dagi VIDEO_DETAIL_SECTIONS), yangilik resursi EMAS.
// Bir xil `labelKey` admin tarjimalarida `clientSection.items.*`.

export const CLIENT_SECTION_GROUPS = [
  {
    group: "main",
    items: ["dashboard", "leads", "staff", "groups", "groups/detail", "students", "students/detail", "qr-attendance", "certificates", "subscription", "profile", "notifications"],
  },
  // O'qituvchi/Yordamchi menyusi
  { group: "teacher", items: ["lesson", "my-plans"] },
  // "Jadval" — bitta band, ichida 2 tab
  { group: "schedule", items: ["schedule", "calendar"] },
  // "Moliya" — bitta band, ichida tablar (hodimda "Mening hisobim" ham)
  { group: "finance", items: ["revenue", "expenses", "salary", "reports", "reports/teacher-performance", "finance"] },
  // "Sozlamalar" — bitta band, ichida tablar
  { group: "settings", items: ["centers", "rooms", "rooms/detail", "subjects", "archive", "audit-log"] },
];

// "reports/teacher-performance" → "reportsTeacherPerformance" (i18n kaliti uchun).
const toLabelId = (key) => key.replace(/[/-]+([a-z])/g, (_, c) => c.toUpperCase());

export const clientSectionLabelKey = (key) => `clientSection.items.${toLabelId(key)}`;
export const clientGroupLabelKey = (group) => `clientSection.groups.${group}`;

const isVideoOnly = (key) => key.endsWith("/detail");

// Tekis ro'yxat: { key, path, group, labelKey, videoOnly }
export const CLIENT_SECTIONS = CLIENT_SECTION_GROUPS.flatMap(({ group, items }) =>
  items.map((key) => ({
    key,
    path: `/${key}`,
    group,
    labelKey: clientSectionLabelKey(key),
    videoOnly: isVideoOnly(key),
  })),
);

// Yangilik "Ichki sahifa" resurslari — haqiqiy marshrutlar (detail kalitlarisiz).
export const CLIENT_PAGE_SECTIONS = CLIENT_SECTIONS.filter((section) => !section.videoOnly);
