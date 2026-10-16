import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { api, CENTERS_CHANGED_EVENT, getActiveCenter, getAuthType, setActiveCenter } from "./utils/fetching";
import { updateUser } from "./contexts/user";
import { setTutorialVideos } from "./contexts/tutorialVideos";
import { useSocketEvent } from "./hooks/useSocketEvent";
import Loading from "./ui/Loading";
import Auth from "./pages/Auth";
import Navbar from "./components/Navbar";
import { FinanceLayout, ScheduleLayout, SettingsLayout } from "./components/TabsLayout";
import Top from "./components/Top";
import CenterActionsHost from "./components/center/CenterActionsHost";
import Logout from "./components/Logout";
import SubscriptionExpiredBanner from "./components/SubscriptionExpiredBanner";
import SubscriptionBlockedModal from "./components/SubscriptionBlockedModal";
import GlobalQrScanner from "./components/GlobalQrScanner";
import Introduction from "./components/Introduction/Introduction";
import { INTRO_VERSION, readIntroVersion } from "./components/Introduction/steps";
import useNewsSync from "./hooks/useNewsSync";
import ReceptionHome from "./pages/ReceptionHome";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import TeacherHome from "./pages/TeacherHome";
import Staff from "./pages/Staff";
import StaffDetail from "./pages/Staff/StaffDetail";
import Subjects from "./pages/Subjects";
import Rooms from "./pages/Rooms";
import RoomDetail from "./pages/Rooms/RoomDetail";
import Groups from "./pages/Groups";
import GroupDetail from "./pages/Groups/GroupDetail";
import Individual from "./pages/Individual";
import Schedule from "./pages/Schedule";
import Lesson from "./pages/Lesson";
import MyPlans from "./pages/MyPlans";
import PlanEditor from "./pages/MyPlans/PlanEditor";
import Students from "./pages/Students";
import StudentDetail from "./pages/Students/StudentDetail";
import StudentAchievements from "./pages/Students/StudentAchievements";
import { BADGE_FEATURE } from "./utils/badges";
import Leads from "./pages/Leads";
import Subscription from "./pages/Subscription";
import Salary from "./pages/Salary";
import Expenses from "./pages/Expenses";
import StaffProfile from "./pages/StaffProfile";
import Finance from "./pages/Finance";
import OwnerProfile from "./pages/OwnerProfile";
import Notifications from "./pages/Notifications";
import QrAttendance from "./pages/QrAttendance";
import Revenue from "./pages/Revenue";
import TeacherPerformance from "./pages/Reports/TeacherPerformance";
import Reports from "./pages/Reports";
import AuditLog from "./pages/AuditLog";
import Certificates from "./pages/Certificates";
import Coins from "./pages/Coins";
import TemplateEditor from "./pages/Certificates/TemplateEditor";
import CertificateVerify from "./pages/CertificateVerify";
import NotFound from "./pages/NotFound";
import UiLab from "./pages/UiLab";
import Calendar from "./pages/Calendar";
import Archive from "./pages/Archive";
import VideoLessons from "./pages/VideoLessons";
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
  const { _id, authType, role, introSeen } = useSelector((e) => e?.user);
  // O'qituvchi o'quvchilar ro'yxati/kartochkasiga kirmaydi (u yerda moliyaviy
  // ma'lumot bor) — o'quvchilarni faqat o'z guruhi ichida ko'radi.
  // O'qituvchi va yordamchi o'qituvchi umumiy o'quvchilar ro'yxatini
  // ko'rmaydi — o'quvchilarni FAQAT o'z guruhi ichida ko'radi.
  const isTeacher = authType === "staff" && ["teacher", "assistant"].includes(role);
  const can = useCan();
  const hasFeature = useFeature();
  const [load, setLoad] = useState(false);
  const loadedRef = useRef(false);
  const { pathname, search } = useLocation();

  // Admin tarif biriktirsa/o'zgartirsa (`subscription:updated` socket
  // hodisasi) shu funksiya qayta chaqiriladi — Refresh yoki logout kutmasdan
  // `user.subscription`/`tariffFeatures` yangilanadi.
  const verifyUser = useCallback(async () => {
    try {
      const authType = getAuthType();
      const endpoint = VERIFY_ENDPOINT[authType];
      if (!endpoint) return;

      const res = await api.get(endpoint);
      const { ok, data } = res.data;
      if (ok) {
        // Faol filial (docs/API_CONTRACT_multi_center.md §3.3): backend
        // tekshirgan qiymat ustun. Sahifalar allaqachon eski filial bilan
        // yuklangan bo'lsa (masalan filial bloklandi yoki hodimdan olindi) —
        // aralash ma'lumot qolmasligi uchun to'liq reload.
        const next = data.activeCenter || "";
        if (next !== getActiveCenter()) {
          setActiveCenter(next);
          if (loadedRef.current) {
            window.location.reload();
            return;
          }
        }
        dp(updateUser({ ...data, authType }));
      }
    } catch {
      // token yaroqsiz/tarmoq xatosi — Auth sahifasi ko'rsatiladi
    } finally {
      loadedRef.current = true;
      setLoad(true);
    }
  }, [dp]);

  useEffect(() => {
    const t = setTimeout(verifyUser, 0);
    return () => clearTimeout(t);
  }, [verifyUser]);

  // Video darslik ro'yxati — GET ochiq, auth kutmasdan bir marta yuklanadi.
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/tutorial-videos");
        const { ok, data } = res.data;
        if (ok && Array.isArray(data)) dp(setTutorialVideos(data));
      } catch {
        // sahifa ochilishida yuklanmasa ham sahifalar bo'sh holatni ko'rsatadi
      }
    })();
  }, [dp]);

  useSocketEvent("subscription:updated", verifyUser, !!_id);
  // Filial bloklandi/ochildi — filiallar ro'yxati va faol filial qayta olinadi.
  useSocketEvent("center:statusChanged", verifyUser, !!_id);
  useEffect(() => {
    window.addEventListener(CENTERS_CHANGED_EVENT, verifyUser);
    return () => window.removeEventListener(CENTERS_CHANGED_EVENT, verifyUser);
  }, [verifyUser]);

  // Sertifikat QR tekshiruvi — LOGIN talab qilmaydi (ish stolidan tashqarida
  // istalgan tashrif buyuruvchi skanerlaydi), shuning uchun auth holatini
  // KUTMASDAN, `load`/`_id` tekshiruvidan OLDIN alohida render qilinadi.
  if (pathname.startsWith("/certificate/verify/")) {
    return (
      <Routes>
        <Route path="/certificate/verify/:code" element={<CertificateVerify />} />
      </Routes>
    );
  }

  // UI Lab — form komponentlarining barcha holatlari bitta sahifada. Faqat
  // `vite dev` rejimida mavjud (prod bundlega tushmaydi) va login talab
  // qilmaydi, shuning uchun auth tekshiruvidan OLDIN render qilinadi.
  // `/ui-lab` — komponentlar ro'yxati; `?uilab=1` esa lab'ni ISTALGAN manzilda
  // ochadi (masalan `/groups?uilab=1`), shunda Navbar aktiv bo'limni to'g'ri
  // ko'rsatadi — u manzilni `useLocation()` dan o'qiydi.
  if (import.meta.env.DEV && (pathname === "/ui-lab" || search.includes("uilab")))
    return <UiLab />;

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
        {authType === "owner" && <CenterActionsHost />}
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
              {/* Sozlamalar — kam ochiladigan ro'yxat sahifalari bitta tab
                  qatori ostida (SettingsLayout). URL'lar o'zgarmagan. */}
              <Route element={<SettingsLayout />}>
                {can("room:view") && <Route path="/rooms" element={<Rooms />} />}
                {/* O'qituvchi/yordamchiga Fanlar bo'limi ko'rsatilmaydi — `subject:view`
                    ruxsati qoladi (guruh/dars sahifalari fan nomini API'dan oladi). */}
                {can("subject:view") && !isTeacher && <Route path="/subjects" element={<Subjects />} />}
                {/* Arxiv — API_CONTRACT_archive.md. O'qituvchi/yordamchi uchun
                    butunlay yopiq (backendda ham `blockTeachingRoles`). */}
                {can("archive:view") && !isTeacher && <Route path="/archive" element={<Archive />} />}
                {/* Audit jurnali — FAQAT Client Owner (`audit:view` hodimga berilmaydi). */}
                {authType === "owner" && <Route path="/audit-log" element={<AuditLog />} />}
              </Route>
              {authType === "owner" && <Route path="/subscription" element={<Subscription />} />}
              {/* Moliya — tushum/xarajat/oylik/hisobot (+ hodimning o'z hisobi)
                  bitta tab qatori ostida. */}
              <Route element={<FinanceLayout />}>
                {authType === "staff" && <Route path="/finance" element={<Finance />} />}
                {authType === "owner" && <Route path="/revenue" element={<Revenue />} />}
                {can("expense:view") && <Route path="/expenses" element={<Expenses />} />}
                {can("salary:view") && <Route path="/salary" element={<Salary />} />}
                {/* Hisobotlar — moliyaviy (`finance.report`) va/yoki davomat
                    (`attendance.report`) hisoboti tarifda bo'lsa ochiladi. */}
                {can("report:view") && (hasFeature("finance.report") || hasFeature("attendance.report")) && (
                  <Route path="/reports" element={<Reports />} />
                )}
                {can("report:view") && hasFeature("teacher.performance") && (
                  <Route path="/reports/teacher-performance" element={<TeacherPerformance />} />
                )}
              </Route>
              {/* Filiallar sahifasi yo'q (docs/API_CONTRACT_center_switcher.md) —
                  boshqaruv Top menyu va Dashboard'da. Eski havolalar uchun. */}
              <Route path="/centers/*" element={<Navigate to="/dashboard" replace />} />
              {authType === "owner" && (
                <Route path="/staff" element={<Staff />} />
              )}
              {authType === "owner" && (
                <Route path="/staff/:id" element={<StaffDetail />} />
              )}
              {can("room:view") && (
                <Route path="/rooms/:id" element={<RoomDetail />} />
              )}
              {can("group:view") && (
                <Route path="/groups" element={<Groups />} />
              )}
              {/* Individual o'quvchilar — yordamchi o'qituvchidan boshqa hamma
                  (docs/API_CONTRACT_individual_students.md §4). */}
              {can("group:view") && role !== "assistant" && (
                <Route path="/individual" element={<Individual />} />
              )}
              {/* Individual detali — GroupDetail'ning o'zi, faqat menyuda
                  "Individual" bandi aktiv bo'lishi uchun alohida yo'l. */}
              {can("group:view") && role !== "assistant" && (
                <Route path="/individual/:id" element={<GroupDetail />} />
              )}
              {/* Jadval — haftalik jadval + oylik kalendar bitta tab qatori ostida. */}
              <Route element={<ScheduleLayout />}>
                {can("group:update") && !isTeacher && <Route path="/schedule" element={<Schedule />} />}
                {can("calendar:view") && <Route path="/calendar" element={<Calendar />} />}
              </Route>
              {isTeacher && <Route path="/lesson" element={<Lesson />} />}
              {/* Dars rejalarim — o'qituvchining shablon rejalari
                  (API_CONTRACT_teaching_plans.md §6). */}
              {isTeacher && hasFeature("lesson.planning") && (
                <Route path="/my-plans" element={<MyPlans />} />
              )}
              {isTeacher && hasFeature("lesson.planning") && (
                <Route path="/my-plans/:id" element={<PlanEditor />} />
              )}
              {can("group:view") && (
                <Route path="/groups/:id" element={<GroupDetail />} />
              )}
              {can("student:view") && !isTeacher && (
                <Route path="/students" element={<Students />} />
              )}
              {can("student:view") && !isTeacher && (
                <Route path="/students/:id" element={<StudentDetail />} />
              )}
              {/* O'qituvchi — faqat o'z guruhlaridagi yutuqlar (pul/kontaktsiz) */}
              {isTeacher && hasFeature(BADGE_FEATURE) && (
                <Route path="/students/:id" element={<StudentAchievements />} />
              )}
              {can("lead:view") && !isTeacher && <Route path="/leads" element={<Leads />} />}
              {can("attendance:create") && hasFeature("attendance.qr") && (
                <Route path="/qr-attendance" element={<QrAttendance />} />
              )}
              {authType === "staff" && <Route path="/profile" element={<StaffProfile />} />}
              {authType === "owner" && <Route path="/profile" element={<OwnerProfile />} />}
              <Route path="/notifications" element={<Notifications />} />
              {/* Video qo'llanmalar — barcha rollar, "?" menyusidan ochiladi. */}
              <Route path="/video-lessons" element={<VideoLessons />} />
              {can("certificate:view") && hasFeature("certificate.manage") && (
                <Route path="/certificates" element={<Certificates />} />
              )}
              {can("certificate:create") && hasFeature("certificate.manage") && (
                <Route path="/certificates/template/new" element={<TemplateEditor />} />
              )}
              {can("certificate:update") && hasFeature("certificate.manage") && (
                <Route path="/certificates/template/:id" element={<TemplateEditor />} />
              )}
              {/* WECOIN va filial do'koni (docs/API_CONTRACT_wecoin.md) */}
              {can("coin:view") && hasFeature("gamification.coins") && <Route path="/coins" element={<Coins />} />}
              {/* Ruxsat yo'q yoki mavjud bo'lmagan sahifa — bo'sh oyna emas. */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </div>
      </div>
      <Logout />
      <SubscriptionBlockedModal />
      {/* Apparat QR skaner — istalgan sahifada ishlaydi */}
      <GlobalQrScanner />
      {/* Qo'llab-quvvatlash chati — Owner/Staff har doim ko'radi, permission talab qilinmaydi. */}
      {/* Yangi foydalanuvchi YOKI tur dizayn bilan yangilangan (versiya). */}
      {(!introSeen || readIntroVersion() < INTRO_VERSION) && <Introduction />}
      {/* Yangiliklar: store sinxroni + o'qilmaganlar oynasi (API_CONTRACT_news.md §5).
          Faqat shu autentifikatsiyadan keyingi layout'da — login'da yo'q. */}
      <NewsSync />
    </div>
  );
}

export default App;

// Yangiliklar store sinxroni (socket + boshlang'ich yuklash). Avval
// NewsPopup ichida edi; popup olib tashlandi — yangiliklar endi o'zi
// ochilmaydi, qo'ng'iroqcha soni va Bildirishnomalar > Yangiliklar tabida.
function NewsSync() {
  useNewsSync();
  return null;
}
