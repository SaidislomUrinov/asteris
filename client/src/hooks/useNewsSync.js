import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSocketEvent } from "./useSocketEvent";
import {
  appendNews,
  fetchNewsUnread,
  fetchNewsUnreadCount,
  readAllNewsLocal,
  readNewsLocal,
  removeNews,
  resetNewsSession,
  setNewsUnread,
  updateNews,
} from "../contexts/news";
import { audienceMatches } from "../components/news/newsUtils";

/**
 * Yangiliklar store'ini server bilan sinxron ushlaydi (API_CONTRACT_news.md §4).
 * BIR MARTA — autentifikatsiyadan keyingi layout'da (App.jsx `NewsSync`) —
 * chaqiriladi; qo'ng'iroq, tab va popup hammasi `state.news`dan o'qiydi.
 */
export default function useNewsSync() {
  const dp = useDispatch();
  const { _id, authType } = useSelector((e) => e.user);
  const enabled = !!_id;

  // Boshlang'ich yuklash. `setTimeout(0)` — StrictMode'dagi soxta
  // unmount/mount'da birinchi taymer bekor bo'ladi, so'rov bitta ketadi.
  useEffect(() => {
    if (!enabled) return;
    const id = setTimeout(() => dp(fetchNewsUnread()), 0);
    return () => clearTimeout(id);
  }, [dp, enabled, _id]);

  // Chiqishda optimistic "o'qilgan" to'plami ham tozalanadi.
  useEffect(() => () => resetNewsSession(), []);

  // Ketma-ket kelgan hodisalar uchun son bitta so'rov bilan yangilanadi.
  const countTimer = useRef(null);
  const refreshCount = () => {
    clearTimeout(countTimer.current);
    countTimer.current = setTimeout(() => dp(fetchNewsUnreadCount()), 400);
  };
  useEffect(() => () => clearTimeout(countTimer.current), []);

  useSocketEvent(
    "news:new",
    (p) => {
      if (!p?.news?._id || !audienceMatches(p.audience, authType)) return;
      // Yangi chop etilgan yangilikning `publishedAt`i doim foydalanuvchi
      // `createdAt`idan keyin — createdAt filtri bu yerda kerak emas.
      dp(appendNews(p.news));
      refreshCount();
    },
    enabled,
  );

  useSocketEvent(
    "news:updated",
    (p) => {
      if (!p?.news?._id) return;
      if (audienceMatches(p.audience, authType)) dp(updateNews(p.news));
      else {
        // Auditoriya o'zgarib, endi bu foydalanuvchiga tegishli emas.
        dp(removeNews(p.news._id));
        refreshCount();
      }
    },
    enabled,
  );

  useSocketEvent(
    "news:removed",
    (p) => {
      if (!p?.id) return;
      dp(removeNews(p.id));
      refreshCount();
    },
    enabled,
  );

  // Boshqa tab/qurilmada (yoki shu tabda — server hammaga yuboradi) o'qildi.
  useSocketEvent(
    "news:read",
    (p) => {
      if (p?.all) dp(readAllNewsLocal());
      else if (p?.id) dp(readNewsLocal({ id: p.id, wasUnread: false }));
      if (typeof p?.unread === "number") dp(setNewsUnread(p.unread));
    },
    enabled,
  );

  // Qayta ulanishda o'tkazib yuborilgan hodisalar bo'lishi mumkin.
  useSocketEvent("connect", () => dp(fetchNewsUnread()), enabled);
}
