import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { api } from "./utils/fetching";
import { updateUser } from "./contexts/user";
import Loading from "./ui/Loading";
import Auth from "./pages/Auth";
import Navbar from "./components/Navbar";
import Top from "./components/Top";
import Logout from "./components/Logout";
import { Routes, Route } from "react-router-dom";
import Leads from "./pages/Leads";
import LeadsDocs from "./pages/Leads/Docs";
import Tariffs from "./pages/Tariffs";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import AuditLog from "./pages/AuditLog";
import Monitoring from "./pages/Monitoring";
import Logs from "./pages/Logs";
import Settings from "./pages/Settings";
import Fonts from "./pages/Fonts";
import TutorialVideos from "./pages/TutorialVideos";
import Chat from "./pages/Chat";
import News from "./pages/News";
import NewsEditor from "./pages/News/NewsEditor";
import { hasPermission } from "./utils/permission";
function App() {
  const dp = useDispatch();
  const { _id, permissions } = useSelector((e) => e?.user);
  const canManageNews = hasPermission(permissions, "news:manage");
  const [load, setLoad] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/admin/verify");
        const { ok, data } = res.data;
        if (ok) dp(updateUser(data));
      } catch {
        // token yaroqsiz — login sahifasi ko'rsatiladi
      } finally {
        setLoad(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        {/* Top h-15 (60px) — qolgan joy sahifaga beriladi. Sahifa o'zi to'liq balandlikni oladi;
            List kabi ichki komponentlar shu balandlik ichida mustaqil Y scroll qiladi,
            boshqa (list bo'lmagan) sahifalar shu wrapper orqali scroll bo'ladi. */}
        <div className="flex-1 w-full min-h-0 overflow-y-auto">
          <div className="p-4 h-full flex flex-col">
            <Routes>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/leads" element={<Leads />} />
              <Route path="/leads/docs" element={<LeadsDocs />} />
              <Route path="/tariffs" element={<Tariffs />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/audit-log" element={<AuditLog />} />
              <Route path="/monitoring" element={<Monitoring />} />
              <Route path="/logs" element={<Logs />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/fonts" element={<Fonts />} />
              <Route path="/tutorial-videos" element={<TutorialVideos />} />
              <Route path="/chat" element={<Chat />} />
              {canManageNews && <Route path="/news" element={<News />} />}
              {canManageNews && <Route path="/news/new" element={<NewsEditor key="new" />} />}
              {canManageNews && <Route path="/news/:id" element={<NewsEditor key="edit" />} />}
            </Routes>
          </div>
        </div>
      </div>
      <Logout />
    </div>
  );
}

export default App;
