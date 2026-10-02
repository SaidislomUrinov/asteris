// Client ilovasidagi parametrsiz sahifalar katalogi (`client/src/App.jsx`
// route'laridan olingan). Resurs "Ichki sahifa" turida bo'lsa shu ro'yxatdan
// tanlanadi. Ba'zi sahifalar faqat ma'lum rol/ruxsat/tarifda ochiladi —
// ko'rinmaydigan foydalanuvchida client tomoni o'zi qaror qiladi.
export const CLIENT_ROUTES = [
  { path: "/dashboard", labelKey: "news.routes.dashboard" },
  { path: "/centers", labelKey: "news.routes.centers" },
  { path: "/staff", labelKey: "news.routes.staff" },
  { path: "/subjects", labelKey: "news.routes.subjects" },
  { path: "/rooms", labelKey: "news.routes.rooms" },
  { path: "/groups", labelKey: "news.routes.groups" },
  { path: "/schedule", labelKey: "news.routes.schedule" },
  { path: "/calendar", labelKey: "news.routes.calendar" },
  { path: "/lesson", labelKey: "news.routes.lesson" },
  { path: "/students", labelKey: "news.routes.students" },
  { path: "/leads", labelKey: "news.routes.leads" },
  { path: "/qr-attendance", labelKey: "news.routes.qrAttendance" },
  { path: "/salary", labelKey: "news.routes.salary" },
  { path: "/expenses", labelKey: "news.routes.expenses" },
  { path: "/revenue", labelKey: "news.routes.revenue" },
  { path: "/reports", labelKey: "news.routes.reports" },
  { path: "/reports/teacher-performance", labelKey: "news.routes.teacherPerformance" },
  { path: "/certificates", labelKey: "news.routes.certificates" },
  { path: "/archive", labelKey: "news.routes.archive" },
  { path: "/audit-log", labelKey: "news.routes.auditLog" },
  { path: "/subscription", labelKey: "news.routes.subscription" },
  { path: "/finance", labelKey: "news.routes.finance" },
  { path: "/profile", labelKey: "news.routes.profile" },
  { path: "/notifications", labelKey: "news.routes.notifications" },
];

export const findClientRoute = (path) => CLIENT_ROUTES.find((r) => r.path === path);
