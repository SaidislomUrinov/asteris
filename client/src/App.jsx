import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { api, getAuthType } from "./utils/fetching";
import { updateUser } from "./contexts/user";
import Loading from "./ui/Loading";
import Auth from "./pages/Auth";
import Navbar from "./components/Navbar";
import Top from "./components/Top";
import Logout from "./components/Logout";
import SubscriptionExpiredBanner from "./components/SubscriptionExpiredBanner";
import SubscriptionBlockedModal from "./components/SubscriptionBlockedModal";
import GlobalQrScanner from "./components/GlobalQrScanner";
import ReceptionHome from "./pages/ReceptionHome";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import TeacherHome from "./pages/TeacherHome";
import Centers from "./pages/Centers";
import CenterDetail from "./pages/Centers/CenterDetail";
import Staff from "./pages/Staff";
import StaffDetail from "./pages/Staff/StaffDetail";
import Subjects from "./pages/Subjects";
import Rooms from "./pages/Rooms";
import RoomDetail from "./pages/Rooms/RoomDetail";
import Groups from "./pages/Groups";
import GroupDetail from "./pages/Groups/GroupDetail";
import Schedule from "./pages/Schedule";
import Lesson from "./pages/Lesson";
import Students from "./pages/Students";
import StudentDetail from "./pages/Students/StudentDetail";
import Subscription from "./pages/Subscription";
import Salary from "./pages/Salary";
import Expenses from "./pages/Expenses";
import StaffProfile from "./pages/StaffProfile";
import Notifications from "./pages/Notifications";
import QrAttendance from "./pages/QrAttendance";
import Revenue from "./pages/Revenue";
import useCan from "./hooks/useCan";
import useFeature from "./hooks/useFeature";

// Login paytida tanlangan rolga qarab tekshiriladigan endpoint boshqacha —
// Client Owner va Staff mustaqil auth zanjiri (server/CLAUDE.md "Autentifikatsiya").
const VERIFY_ENDPOINT = {
  owner: "/client-auth/verify",
  staff: "/staff-auth/verify",
};

function App() {
  const dp = useDispatch();
  const { _id, authType, role } = useSelector((e) => e?.user);
  // O'qituvchi o'quvchilar ro'yxati/kartochkasiga kirmaydi (u yerda moliyaviy
  // ma'lumot bor) — o'quvchilarni faqat o'z guruhi ichida ko'radi.
  // O'qituvchi va yordamchi o'qituvchi umumiy o'quvchilar ro'yxatini
  // ko'rmaydi — o'quvchilarni FAQAT o'z guruhi ichida ko'radi.
  const isTeacher = authType === "staff" && ["teacher", "assistant"].includes(role);
  const can = useCan();
  const hasFeature = useFeature();
  const [load, setLoad] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    (async () => {
      try {
        const authType = getAuthType();
        const endpoint = VERIFY_ENDPOINT[authType];
        if (!endpoint) return;

        const res = await api.get(endpoint);
        const { ok, data } = res.data;
        if (ok) dp(updateUser({ ...data, authType }));
      } catch {
      } finally {
        setLoad(true);
      }
    })();
  }, []);

  if (!load)
    return (
      <div className="flex items-center justify-center w-full h-screen">
        <Loading />
      </div>
    );
  if (!_id) return <Auth />;
  return (
    <div className="flex items-start justify-start w-full">
      <Navbar />
      <div className="flex h-screen items-start justify-start flex-col flex-1 lg:ml-62.5 w-full overflow-hidden">
        <Top />
        <SubscriptionExpiredBanner />
        {/* Mobil pastki tab bar (h-16, fixed) sahifa oxirini yopib qo'ymasligi
            uchun bo'sh joy KONTENT div'iga beriladi — scroll konteynerining
            `padding-bottom`i overflow qilgan kontent uchun hisobga olinmasligi
            mumkin, ichki div'ning padding'i esa har doim scrollHeight'ga kiradi. */}
        <div className="flex-1 w-full min-h-0 overflow-y-auto">
          {/* Mobil: sahifalar ildizi `h-full` bilan yozilgani uchun uzun kontent
              konteynerdan TASHQARIGA toshib ketardi va pastki bo'sh joy
              ishlamas, oxirgi blok tab bar ostida qolardi. Shuning uchun kichik
              ekranda ildizga `h-auto` + `min-h-full` beriladi — sahifa tabiiy
              o'sadi va `pb-20` tab bar uchun joy qoldiradi.
              Katta ekranda (lg) hech narsa o'zgarmaydi: `h-full` saqlanadi,
              ya'ni `List` avvalgidek ichida scroll bo'lib, paginatsiya pastda
              qotib turadi. */}
          <div
            key={pathname}
            className="p-4 pb-20 lg:pb-4 flex flex-col min-h-full lg:h-full max-lg:[&>*]:!h-auto max-lg:[&>*]:min-h-full"
          >
            <Routes>
              {/* Ildiz yo'l uchun marshrut yo'q edi — shu manzilga to'g'ridan-to'g'ri
                  kirilsa (yoki login'dan keyin) kontent bo'sh qolardi. */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route
                path="/dashboard"
                element={
                  authType === "staff" && ["teacher", "assistant"].includes(role) ? (
                    <TeacherHome />
                  ) : authType === "staff" && role === "reception" ? (
                    <ReceptionHome />
                  ) : (
                    <Dashboard />
                  )
                }
              />
              {authType === "owner" && (
                <Route path="/centers" element={<Centers />} />
              )}
              {authType === "owner" && (
                <Route path="/centers/:id" element={<CenterDetail />} />
              )}
              {authType === "owner" && (
                <Route path="/staff" element={<Staff />} />
              )}
              {authType === "owner" && (
                <Route path="/staff/:id" element={<StaffDetail />} />
              )}
              {can("subject:view") && (
                <Route path="/subjects" element={<Subjects />} />
              )}
              {can("room:view") && (
                <Route path="/rooms" element={<Rooms />} />
              )}
              {can("room:view") && (
                <Route path="/rooms/:id" element={<RoomDetail />} />
              )}
              {can("group:view") && (
                <Route path="/groups" element={<Groups />} />
              )}
              {can("group:update") && (
                <Route path="/schedule" element={<Schedule />} />
              )}
              {isTeacher && <Route path="/lesson" element={<Lesson />} />}
              {can("group:view") && (
                <Route path="/groups/:id" element={<GroupDetail />} />
              )}
              {can("student:view") && !isTeacher && (
                <Route path="/students" element={<Students />} />
              )}
              {can("student:view") && !isTeacher && (
                <Route path="/students/:id" element={<StudentDetail />} />
              )}
              {can("attendance:create") && hasFeature("attendance.qr") && (
                <Route path="/qr-attendance" element={<QrAttendance />} />
              )}
              <Route path="/salary" element={<Salary />} />
              {can("expense:view") && (
                <Route path="/expenses" element={<Expenses />} />
              )}
              {authType === "owner" && (
                <Route path="/revenue" element={<Revenue />} />
              )}
              {authType === "owner" && (
                <Route path="/subscription" element={<Subscription />} />
              )}
              {authType === "staff" && <Route path="/profile" element={<StaffProfile />} />}
              <Route path="/notifications" element={<Notifications />} />
            </Routes>
          </div>
        </div>
      </div>
      <Logout />
      <SubscriptionBlockedModal />
      {/* Apparat QR skaner — istalgan sahifada ishlaydi */}
      <GlobalQrScanner />
    </div>
  );
}

export default App;
