import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { setBackButton } from "../lib/telegram";
import { useWorker } from "./useWorker";
import { FULLSCREEN_PATHS, rootPathsOf } from "./constants";
import { WorkerTabBar } from "./WorkerTabBar";
import { PaymentSheet } from "./PaymentSheet";
import { AttendanceSheet } from "./AttendanceSheet";
import { Today } from "./pages/Today";
import { Finance } from "./pages/Finance";
import { Report } from "./pages/Report";
import { Debtors } from "./pages/Debtors";
import { Leads } from "./pages/Leads";
import { Groups } from "./pages/Groups";
import { GroupDetail } from "./pages/GroupDetail";
import { StudentDetail } from "./pages/StudentDetail";
import { Search } from "./pages/Search";
import { Menu } from "./pages/Menu";
import { Salary } from "./pages/Salary";
import { Grades } from "./pages/Grades";
import { Notifications } from "./pages/Notifications";
import { Profile } from "./pages/Profile";
import { QrAttendance } from "./pages/QrAttendance";
import { Support } from "./pages/Support";

// Ishchi paneli qobig'i: sahifalar + rolga mos tab bar + markaziy amal oynalari.
export const WorkerShell = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { role, sheet, closeSheet, pageBackRef } = useWorker();

  // Guruh detali tablari almashganda (/groups/:id/:tab) sahifa tepaga sakramaydi.
  const scrollKey = pathname.replace(/^(\/groups\/[^/]+)\/.*$/, "$1");
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [scrollKey]);

  // Ichki sahifalarda (guruh/o'quvchi detali, qidiruv, menyu bandlari) —
  // tarix bo'lsa bitta orqaga, aks holda bosh sahifaga. `sheet` deps'da:
  // oyna yopilgach tugma sahifa amaliga qaytadi.
  useEffect(() => {
    const isRoot = rootPathsOf(role).includes(pathname);
    const back = isRoot
      ? null
      : () => {
          if ((window.history.state?.idx || 0) > 0) navigate(-1);
          else navigate("/", { replace: true });
        };
    pageBackRef.current = back;
    if (!sheet) setBackButton(!!back, back);
    return () => {
      pageBackRef.current = null;
      setBackButton(false);
    };
  }, [pathname, navigate, role, sheet, pageBackRef]);

  return (
    <>
      <Routes>
        <Route path="/" element={<Today />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/report" element={<Report />} />
        <Route path="/debtors" element={<Debtors />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/groups" element={<Groups />} />
        <Route path="/groups/:id/:tab?" element={<GroupDetail />} />
        <Route path="/students/:id" element={<StudentDetail />} />
        <Route path="/search" element={<Search />} />
        <Route path="/menu" element={<Menu />} />
        <Route path="/salary" element={<Salary />} />
        <Route path="/grades" element={<Grades />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/qr" element={<QrAttendance />} />
        <Route path="/support" element={<Support />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {/* To'liq ekranli sahifalarda (yordam chati) tab bar yashirin — yozish maydoni pastda. */}
      {!FULLSCREEN_PATHS.includes(pathname) && <WorkerTabBar />}
      {sheet?.type === "payment" && (
        <PaymentSheet
          open
          initialStudent={sheet.payload?.student || null}
          initialEntryId={sheet.payload?.entryId || null}
          initialMonth={sheet.payload?.month || null}
          initialAmount={sheet.payload?.amount}
          onClose={closeSheet}
        />
      )}
      {sheet?.type === "attendance" && <AttendanceSheet open onClose={closeSheet} />}
    </>
  );
};
