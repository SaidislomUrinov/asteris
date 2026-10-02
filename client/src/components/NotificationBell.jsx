import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
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
  // Yangiliklar soni umumiy store'dan (contexts/news.js) — badge ikkalasining yig'indisi.
  const newsUnread = useSelector((e) => e.news.unread);
  const total = unread + newsUnread;

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

  // Bildirishnomalar sahifasida o'qilganda son darhol yangilanadi.
  useEffect(() => {
    const onUnread = (e) => setUnread(Math.max(0, Number(e.detail) || 0));
    window.addEventListener("notifications:unread", onUnread);
    return () => window.removeEventListener("notifications:unread", onUnread);
  }, []);

  // Yangi bildirishnoma — server `user:{id}` xonasiga yuboradi.
  useSocketEvent("notification:new", () => setUnread((n) => n + 1));

  // Boshqa tab/qurilmada o'qilganda server aniq sonni yuboradi (markRead /
  // markAllRead → `notification:unread`), shunda qo'ng'iroq hamma joyda
  // bir xil bo'ladi — yuqoridagi window-event faqat shu tab ichida ishlaydi.
  useSocketEvent("notification:unread", (p) => setUnread(Math.max(0, Number(p?.unread) || 0)));

  // Ulanish uzilib qayta tiklanganda o'tkazib yuborilgan eventlar bo'lishi
  // mumkin — aniq sonni qayta so'raymiz. Tab fonda turganda ham xuddi shu.
  useSocketEvent("connect", fetchCount);
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchCount();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchCount]);

  return (
    <button
      type="button"
      data-intro="notifications"
      title={t("notification.title")}
      // Faqat yangiliklar o'qilmagan bo'lsa — to'g'ridan-to'g'ri "Yangiliklar" tabiga.
      onClick={() => navigate(unread === 0 && newsUnread > 0 ? "/notifications?tab=news" : "/notifications")}
      className="relative flex items-center justify-center w-9 h-9 rounded-lg text-white/70 hover:bg-white/10 hover:text-white cursor-pointer transition-colors"
    >
      <HiBell size={18} />
      {total > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-4.5 h-4.5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold tabular-nums">
          {total > 9 ? "9+" : total}
        </span>
      )}
    </button>
  );
}

export default NotificationBell;
