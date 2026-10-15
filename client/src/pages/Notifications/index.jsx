import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { HiCheck } from "react-icons/hi2";
import Button from "../../ui/Button";
import Dialog from "../../ui/Dialog";
import Loading from "../../ui/Loading";
import IntegrationCard from "./IntegrationCard";
import NotificationEmptyState from "./NotificationEmptyState";
import NotificationItem from "./NotificationItem";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import useFeature from "../../hooks/useFeature";
import useQueryState from "../../hooks/useQueryState";
import NewsTab from "./NewsTab";

// "Bildirishnomalar" | "Yangiliklar" tablari — `?tab=news` (URL'da, qo'ng'iroq
// to'g'ridan-to'g'ri shu tabga olib keladi).
const TABS = [
  { key: "notifications", labelKey: "notification.title" },
  { key: "news", labelKey: "news.title" },
];

// Ulanish jarayonida havola ochilgach, foydalanuvchi Telegram'da "Start"
// bosishini kutamiz — shu oraliqda holatni sekin-sekin so'raymiz.
const POLL_MS = 3000;
const POLL_MAX = 40; // ~2 daqiqa

/**
 * "Bildirishnomalar" sahifasi (`/notifications`) — qo'ng'iroq endi bevosita
 * shu yerga o'tkazadi (avvalgi dropdown olib tashlangan, chunki bu yerda
 * Telegram ulash/til sozlamalari ham bor). Rol bo'yicha tavsif matni +
 * ulash/uzish + til tanlovi + bildirishnomalar ro'yxati.
 */
function Notifications() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useSelector((e) => e.user);
  const hasFeature = useFeature();
  const [tab, setTab] = useQueryState("tab", "notifications");
  const newsUnread = useSelector((e) => e.news.unread);
  const telegramAllowed = hasFeature("telegram.notifications");
  // Rolga qarab vazifalar tavsifi — Client Owner, Resepshin, O'qituvchi/
  // Yordamchi (bot/i18n.js dagi tasdiqlash matni bilan bir xil mazmun).
  const roleKey =
    user.authType === "owner"
      ? "owner"
      : user.role === "reception"
        ? "reception"
        : user.role === "teacher" || user.role === "assistant"
          ? "teacher"
          : "generic";

  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // "all" | "unread" — faqat allaqachon olingan ro'yxat ustida, backend'ga qo'shimcha so'rov yubormaydi

  const [tg, setTg] = useState(null); // { linked, lang }
  const [tgLoading, setTgLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [unlinkTarget, setUnlinkTarget] = useState(false);
  const pollRef = useRef(null);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/notifications");
      const { ok, data, unread: u } = res.data;
      if (!ok) return;
      setItems(data || []);
      listLoadedRef.current = true;
      setUnread(u || 0);
    } catch {
      // ikkinchi darajali — xato toast chiqarilmaydi
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTgStatus = useCallback(async () => {
    try {
      const res = await api.get("/telegram/status");
      if (res.data.ok) setTg(res.data.data);
    } catch {
      // jim
    } finally {
      setTgLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(fetchList, 0);
    return () => clearTimeout(id);
  }, [fetchList]);

  useEffect(() => {
    const id = setTimeout(() => (telegramAllowed ? fetchTgStatus() : setTgLoading(false)), 0);
    return () => clearTimeout(id);
  }, [fetchTgStatus, telegramAllowed]);

  useEffect(() => () => clearInterval(pollRef.current), []);

  // Qo'ng'iroqdagi (NotificationBell) sonni refresh'siz sinxronlash — ro'yxat
  // yuklangandan keyingina (boshlang'ich 0 bell sonini vaqtincha o'chirmasin).
  const listLoadedRef = useRef(false);
  useEffect(() => {
    if (!listLoadedRef.current) return;
    window.dispatchEvent(new CustomEvent("notifications:unread", { detail: unread }));
  }, [unread]);

  useSocketEvent("notification:new", (payload) => {
    setUnread((n) => n + 1);
    setItems((prev) => [payload, ...prev].slice(0, 30));
  });

  const openItem = async (item) => {
    if (!item.read) {
      setItems((prev) => prev.map((x) => (x._id === item._id ? { ...x, read: true } : x)));
      setUnread((n) => Math.max(0, n - 1));
      try {
        await api.patch(`/notifications/${item._id}/read`);
      } catch {
        // jim
      }
    }
    if (item.type === "shop:order") navigate(`/coins?tab=orders&center=${item.data?.centerId || ""}`);
    else if (item.data?.groupId) navigate(`/groups/${item.data.groupId}`);
  };

  const markAll = async () => {
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    setUnread(0);
    try {
      await api.patch("/notifications/read-all");
    } catch {
      // jim
    }
  };

  const connectTelegram = async () => {
    try {
      setConnecting(true);
      const res = await api.post("/telegram/link");
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      if (!data.deepLink) throw new Error("telegram.botUnavailable");

      window.open(data.deepLink, "_blank", "noopener,noreferrer");

      let ticks = 0;
      pollRef.current = setInterval(async () => {
        ticks += 1;
        const statusRes = await api.get("/telegram/status").catch(() => null);
        const linked = statusRes?.data?.data?.linked;
        if (linked) {
          clearInterval(pollRef.current);
          setConnecting(false);
          setTg(statusRes.data.data);
          successMsg("telegram.linked");
        } else if (ticks >= POLL_MAX) {
          clearInterval(pollRef.current);
          setConnecting(false);
        }
      }, POLL_MS);
    } catch (error) {
      errorMsg(error.message);
      setConnecting(false);
    }
  };

  const confirmUnlink = async () => {
    try {
      const res = await api.post("/telegram/unlink");
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      setTg((prev) => ({ ...prev, linked: false }));
      setUnlinkTarget(false);
      successMsg(msg);
    } catch (error) {
      errorMsg(error.message);
    }
  };

  const changeLang = async (lang) => {
    setTg((prev) => ({ ...prev, lang }));
    try {
      const res = await api.patch("/telegram/lang", { lang });
      if (!res.data.ok) throw new Error(res.data.msg);
    } catch (error) {
      errorMsg(error.message);
    }
  };

  const visibleItems = useMemo(
    () => (filter === "unread" ? items.filter((x) => !x.read) : items),
    [items, filter],
  );

  return (
    <div className="flex flex-col w-full h-full gap-6">
      {/* `shrink-0` — `overflow-x-auto` element flex ustunda balandlik bo'yicha
          0 gacha siqila oladi; xabarlar ko'p bo'lsa tablar ezilib qolardi. */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-night-800 w-full sm:w-fit overflow-x-auto shrink-0">
        {TABS.map((x) => {
          const count = x.key === "news" ? newsUnread : unread;
          const active = (tab === "news" ? "news" : "notifications") === x.key;
          return (
            <button
              key={x.key}
              type="button"
              onClick={() => setTab(x.key)}
              aria-pressed={active}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 h-8 shrink-0 rounded-lg text-[13px] font-semibold cursor-pointer transition-colors duration-150 ${
                active ? "bg-white dark:bg-night-900 text-slate-900 dark:text-slate-100 shadow-sm dark:shadow-none" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {t(x.labelKey)}
              {count > 0 && (
                <span className="inline-flex items-center justify-center min-w-4.5 h-4.5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold tabular-nums">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === "news" ? (
        <NewsTab />
      ) : (
        <>
          {/* ── Telegram ulash + til sozlamasi — faqat tarif ochgan bo'lsa ──── */}
          {telegramAllowed && (
            <IntegrationCard
              linked={!!tg?.linked}
              loading={tgLoading}
              connecting={connecting}
              descriptionKey={`telegram.desc.${roleKey}`}
              lang={tg?.lang}
              onConnect={connectTelegram}
              onUnlinkRequest={() => setUnlinkTarget(true)}
              onLangChange={changeLang}
              fullBleed
            />
          )}

          {/* ── Bildirishnomalar ro'yxati ────────────────────────────────── */}
          <div className="flex flex-col gap-1 p-5 sm:p-6 rounded-2xl border border-slate-200/70 dark:border-night-700/70 bg-white dark:bg-night-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none">
            <div className="flex items-center justify-between gap-3 pb-4 flex-wrap">
              <p className="font-semibold text-slate-800 dark:text-slate-100">{t("notification.title")}</p>

              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-night-800">
                  <button
                    type="button"
                    onClick={() => setFilter("all")}
                    aria-pressed={filter === "all"}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                      filter === "all" ? "bg-white dark:bg-night-900 text-slate-800 dark:text-slate-100 shadow-sm dark:shadow-none" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    {t("notification.filterAll")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilter("unread")}
                    aria-pressed={filter === "unread"}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                      filter === "unread" ? "bg-white dark:bg-night-900 text-slate-800 dark:text-slate-100 shadow-sm dark:shadow-none" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    {t("notification.filterUnread")}
                    {unread > 0 && <span className="ml-1 tabular-nums">({unread})</span>}
                  </button>
                </div>

                {unread > 0 && (
                  <Button
                    color="blue"
                    variant="text"
                    className="gap-1 !px-0 normal-case text-xs"
                    aria-label={t("notification.markAllRead")}
                    onClick={markAll}
                  >
                    <HiCheck />
                    {t("notification.markAllRead")}
                  </Button>
                )}
              </div>
            </div>

            {loading ? (
              <Loading height="20vh" />
            ) : visibleItems.length === 0 ? (
              <NotificationEmptyState />
            ) : (
              <div className="flex flex-col divide-y divide-slate-100 dark:divide-night-700">
                {visibleItems.map((item) => (
                  <NotificationItem key={item._id} item={item} t={t} onOpen={openItem} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <Dialog
        open={!!unlinkTarget}
        onClose={() => setUnlinkTarget(false)}
        title={t("telegram.unlink")}
        actions={
          <>
            <Button color="black" variant="text" onClick={() => setUnlinkTarget(false)}>
              {t("common.cancel")}
            </Button>
            <Button color="red" onClick={confirmUnlink}>
              {t("telegram.unlink")}
            </Button>
          </>
        }
      >
        <p>{t("telegram.unlinkConfirm")}</p>
      </Dialog>
    </div>
  );
}

export default Notifications;
