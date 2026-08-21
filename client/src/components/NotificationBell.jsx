import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { HiBell } from "react-icons/hi2";
import { useSocketEvent } from "../hooks/useSocketEvent";
import { api } from "../utils/fetching";

// Qo'ng'iroq — Top panelda. Bosilganda To'liq "Bildirishnomalar" sahifasiga
// o'tkazadi (ro'yxat endi shu yerda emas, alohida sahifada — dropdown
// olib tashlandi, chunki sahifada Telegram ulash/til sozlamalari ham bor,
// kichkina panelga sig'maydi).
function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  const fetchCount = useCallback(async () => {
    try {
      const res = await api.get("/notifications/unread-count");
      if (res.data.ok) setUnread(res.data.data.unread || 0);
    } catch {
      // jim
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(fetchCount, 0);
    return () => clearTimeout(id);
  }, [fetchCount]);

  // Yangi bildirishnoma — server `user:{id}` xonasiga yuboradi.
  useSocketEvent("notification:new", () => setUnread((n) => n + 1));

  return (
    <button
      type="button"
      title={t("notification.title")}
      onClick={() => navigate("/notifications")}
      className="relative flex items-center justify-center w-9 h-9 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer transition-colors"
    >
      <HiBell size={18} />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-4.5 h-4.5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold tabular-nums">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );
}

export default NotificationBell;
