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
export const NAV_SECTIONS = [
  { path: "/dashboard", titleKey: "nav.dashboard" },
  { path: "/centers", titleKey: "nav.centers" },
  { path: "/staff", titleKey: "nav.staff" },
  { path: "/subjects", titleKey: "nav.subjects" },
  { path: "/rooms", titleKey: "nav.rooms" },
  { path: "/groups", titleKey: "nav.groups" },
  { path: "/schedule", titleKey: "nav.schedule" },
  { path: "/calendar", titleKey: "nav.calendar" },
  { path: "/lesson", titleKey: "nav.lesson" },
  { path: "/my-plans", titleKey: "nav.myPlans" },
  { path: "/students", titleKey: "nav.students" },
  { path: "/leads", titleKey: "nav.leads" },
  { path: "/qr-attendance", titleKey: "nav.qrAttendance" },
  { path: "/salary", titleKey: "nav.salary" },
  { path: "/expenses", titleKey: "nav.expenses" },
  { path: "/revenue", titleKey: "nav.revenue" },
  { path: "/subscription", titleKey: "nav.subscription" },
  { path: "/notifications", titleKey: "nav.notifications" },
  { path: "/profile", titleKey: "nav.profile" },
  { path: "/finance", titleKey: "nav.finance" },
  { path: "/reports/teacher-performance", titleKey: "nav.teacherPerformance" },
  { path: "/certificates", titleKey: "nav.certificates" },
  { path: "/archive", titleKey: "nav.archive" },
  { path: "/audit-log", titleKey: "nav.auditLog" },
  { path: "/reports", titleKey: "nav.reports" },
];

// Bo'lim aktivmi — o'zi yoki uning ichki (detail) sahifasi ochiqmi.
// `/students` ni `/students-archive` kabi boshqa yo'l bilan chalkashtirmaslik
// uchun ataylab `path + "/"` tekshiriladi, oddiy `startsWith` emas.
export const isSectionActive = (pathname, path) =>
  pathname === path || pathname.startsWith(`${path}/`);

// Sahifa sarlavhasi uchun tarjima kaliti (topilmasa `null`).
export const resolveSectionTitleKey = (pathname) =>
  NAV_SECTIONS.find((s) => isSectionActive(pathname, s.path))?.titleKey || null;

// Video darslik (TutorialVideo.sectionKey) — `path`dan boshlang'ich "/"
// olib tashlangan holi (masalan "/reports/teacher-performance" ->
// "reports/teacher-performance"), docs/API_CONTRACT_tutorial_videos.md.
// Detail sahifalarda ham ota bo'limning kaliti qaytadi (`isSectionActive`
// bilan bir xil moslik) — /groups/:id ochiq bo'lsa ham "groups" video
// ko'rsatiladi, chunki foydalanuvchi hamon shu bo'lim ichida.
export const resolveSectionKey = (pathname) =>
  NAV_SECTIONS.find((s) => isSectionActive(pathname, s.path))?.path.slice(1) || null;
