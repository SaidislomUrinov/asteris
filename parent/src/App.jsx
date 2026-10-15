import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { useAuth } from "./contexts/auth";
import { ChildrenProvider } from "./contexts/children";
import { useBackButton } from "./hooks/useBackButton";
import { TabBar } from "./components/TabBar";
import { Top } from "./components/Top";
import { ErrorState } from "./components/States";
import { ListSkeleton, Skeleton } from "./components/Skeleton";
import { Page } from "./components/Page";
import { NotLinked } from "./pages/NotLinked";
// Sahifalar lazy — Telegram ichida birinchi ochilish tez bo'lsin (bundle
// bo'linadi, faqat kerakli sahifa yuklanadi).
const lazyPage = (loader, name) => lazy(() => loader().then((m) => ({ default: m[name] })));
const Home = lazyPage(() => import("./pages/Home"), "Home");
const StudentHome = lazyPage(() => import("./pages/StudentHome"), "StudentHome");
const Child = lazyPage(() => import("./pages/Child"), "Child");
const Group = lazyPage(() => import("./pages/Group"), "Group");
const Payments = lazyPage(() => import("./pages/Payments"), "Payments");
const Notifications = lazyPage(() => import("./pages/Notifications"), "Notifications");
const Settings = lazyPage(() => import("./pages/Settings"), "Settings");
const Coins = lazyPage(() => import("./pages/Coins"), "Coins");
// Ishchi paneli (Boshliq/Hodim) — alohida chunk, ota-ona bundle'iga tushmaydi.
const WorkerApp = lazyPage(() => import("./worker/WorkerApp"), "WorkerApp");

const Shell = () => {
  useBackButton();
  const { pathname } = useLocation();
  const { role, isStudent } = useAuth();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  // key={role}: rol almashsa butun daraxt (children keshi va sahifa so'rovlari)
  // qaytadan yuklanadi.
  return (
    <ChildrenProvider key={role}>
      <Suspense fallback={<Page><ListSkeleton count={4} /></Page>}>
      <Routes>
        <Route path="/" element={isStudent ? <StudentHome /> : <Home />} />
        {/* O'quvchida alohida "farzand" sahifasi va to'lovlar yo'q */}
        <Route path="/child/:sid" element={isStudent ? <Navigate to="/" replace /> : <Child />} />
        <Route path="/child/:sid/group/:eid/:tab?" element={<Group />} />
        <Route path="/payments" element={isStudent ? <Navigate to="/" replace /> : <Payments />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/coins" element={<Coins />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      <TabBar />
    </ChildrenProvider>
  );
};

export default function App() {
  const { status, error, login, isWorker, worker } = useAuth();
  let body;
  if (status === "loading")
    body = (
      <Page withTabBar={false}>
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-20 rounded-2xl" />
        <ListSkeleton count={3} />
      </Page>
    );
  else if (status === "notLinked") body = <NotLinked />;
  else if (status === "error")
    body = (
      <div className="min-h-[70dvh] flex items-center justify-center">
        <ErrorState error={error} onRetry={login} />
      </div>
    );
  else if (isWorker)
    body = (
      <Suspense fallback={<Page><ListSkeleton count={4} /></Page>}>
        <WorkerApp initial={worker} />
      </Suspense>
    );
  else body = <Shell />;
  return (
    <>
      <Top />
      {body}
    </>
  );
}
