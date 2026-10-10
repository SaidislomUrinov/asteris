// Marshrut → bo'lim xaritasi. YAGONA manba: `Top` (sahifa sarlavhasi),
// `Navbar` va `MobileTabBar` (aktiv holat) shu yerdan oladi.
//
// Muhim qoida: detail sahifasi OTA bo'limga tegishli — `/groups/:id` ochiq
// bo'lganda ham sarlavha "Guruhlar" bo'lib turadi va menyudagi "Guruhlar"
// aktiv ko'rinadi. Avval har ikkalasi ham aniq tenglik (`p === to`) bilan
// tekshirilardi, shuning uchun detail sahifalarida sarlavha "WENET" ga
// tushib qolar, menyuda esa hech qaysi bo'lim yonmasdi.
//
// Tartib muhim emas — moslik prefiks bo'yicha aniq topiladi (`/groups` va
// `/schedule` alohida yo'llar, biri ikkinchisining ichida emas).
// Sozlamalar tablari (Filiallar, Xonalar, Fanlar, Arxiv, Audit) —
// sarlavha "Sozlamalar", qaysi tab ochiqligini tab qatori bildiradi.
export const NAV_SECTIONS = [
  { path: "/dashboard", titleKey: "nav.dashboard" },
  { path: "/centers", titleKey: "nav.settings" },
  { path: "/staff", titleKey: "nav.staff" },
  { path: "/subjects", titleKey: "nav.settings" },
  { path: "/rooms", titleKey: "nav.settings" },
  { path: "/groups", titleKey: "nav.groups" },
  { path: "/individual", titleKey: "nav.individual" },
  { path: "/schedule", titleKey: "nav.schedule" },
  { path: "/calendar", titleKey: "nav.schedule" },
  { path: "/lesson", titleKey: "nav.lesson" },
  { path: "/my-plans", titleKey: "nav.myPlans" },
  { path: "/students", titleKey: "nav.students" },
  { path: "/leads", titleKey: "nav.leads" },
  { path: "/qr-attendance", titleKey: "nav.qrAttendance" },
  { path: "/salary", titleKey: "nav.financeSection" },
  { path: "/expenses", titleKey: "nav.financeSection" },
  { path: "/revenue", titleKey: "nav.financeSection" },
  { path: "/subscription", titleKey: "nav.subscription" },
  { path: "/notifications", titleKey: "nav.notifications" },
  { path: "/profile", titleKey: "nav.profile" },
  { path: "/finance", titleKey: "nav.financeSection" },
  { path: "/reports/teacher-performance", titleKey: "nav.financeSection" },
  { path: "/certificates", titleKey: "nav.certificates" },
  { path: "/archive", titleKey: "nav.settings" },
  { path: "/audit-log", titleKey: "nav.settings" },
  { path: "/reports", titleKey: "nav.financeSection" },
  { path: "/video-lessons", titleKey: "nav.videoLessons" },
];

// Bo'lim aktivmi — o'zi yoki uning ichki (detail) sahifasi ochiqmi.
// `/students` ni `/students-archive` kabi boshqa yo'l bilan chalkashtirmaslik
// uchun ataylab `path + "/"` tekshiriladi, oddiy `startsWith` emas.
export const isSectionActive = (pathname, path) =>
  pathname === path || pathname.startsWith(`${path}/`);

// Sahifa sarlavhasi uchun tarjima kaliti (topilmasa `null`).
export const resolveSectionTitleKey = (pathname) =>
  NAV_SECTIONS.find((s) => isSectionActive(pathname, s.path))?.titleKey || null;

// Detail sahifalar o'z videosiga ega (videolar qisqa bo'lishi uchun ro'yxat
// va detail alohida) — docs/API_CONTRACT_tutorial_videos_v2.md § 1.
// Ota bo'lim videosiga fallback YO'Q.
const VIDEO_DETAIL_SECTIONS = [
  { re: /^\/groups\/[^/]+\/?$/, key: "groups/detail" },
  { re: /^\/rooms\/[^/]+\/?$/, key: "rooms/detail" },
  { re: /^\/students\/[^/]+\/?$/, key: "students/detail" },
];

// Video darslik (TutorialVideo.sectionKey) — `path`dan boshlang'ich "/"
// olib tashlangan holi (masalan "/reports/teacher-performance" ->
// "reports/teacher-performance"), docs/API_CONTRACT_tutorial_videos.md.
// Detail naqshlari avval tekshiriladi; boshqa ichki sahifalarda ota
// bo'limning kaliti qaytadi (`isSectionActive` bilan bir xil moslik).
export const resolveSectionKey = (pathname) =>
  VIDEO_DETAIL_SECTIONS.find((s) => s.re.test(pathname))?.key ||
  NAV_SECTIONS.find((s) => isSectionActive(pathname, s.path))?.path.slice(1) ||
  null;

// Video bo'limining nomi (Video qo'llanmalar sahifasida sarlavha ostida).
// Sozlamalar/Moliya tablari NAV_SECTIONS'da umumiy sarlavha oladi, bu
// yerda esa aniq sahifa nomi kerak — shuning uchun alohida xarita.
const VIDEO_SECTION_LABEL_KEYS = {
  "groups/detail": "videoLessons.sections.groupDetail",
  "rooms/detail": "videoLessons.sections.roomDetail",
  "students/detail": "videoLessons.sections.studentDetail",
  "qr-attendance": "nav.qrAttendance",
  "my-plans": "nav.myPlans",
  "audit-log": "nav.auditLog",
  "reports/teacher-performance": "nav.teacherPerformance",
  finance: "nav.myFinance",
};

export const videoSectionLabelKey = (key) => VIDEO_SECTION_LABEL_KEYS[key] || `nav.${key}`;
