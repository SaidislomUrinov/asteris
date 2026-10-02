import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { HiCheck, HiExclamationCircle, HiNewspaper } from "react-icons/hi2";
import Button from "../../ui/Button";
import Loading from "../../ui/Loading";
import NewsItem from "./NewsItem";
import NewsDialog from "../../components/news/NewsDialog";
import useClosingValue from "../../hooks/useClosingValue";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { api } from "../../utils/fetching";
import { audienceMatches } from "../../components/news/newsUtils";
import { markAllNewsRead, markNewsRead } from "../../contexts/news";

const LIMIT = 10;

const dedupe = (list) => {
  const seen = new Set();
  return list.filter((x) => (seen.has(x._id) ? false : seen.add(x._id)));
};

/**
 * Bildirishnomalar sahifasidagi "Yangiliklar" tabi (API_CONTRACT_news.md §5).
 * Ro'yxat sahifalab ("Yana yuklash") olinadi; o'qilmaganlar soni esa umumiy
 * store'dan (qo'ng'iroq va popup bilan bir manba). Karta bosilsa NewsViewer
 * oynasida ochiladi va o'qilgan bo'ladi.
 */
function NewsTab() {
  const { t } = useTranslation();
  const dp = useDispatch();
  const authType = useSelector((e) => e.user.authType);
  const unread = useSelector((e) => e.news.unread);

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [target, setTarget] = useState(null);
  const view = useClosingValue(target);
  const seqRef = useRef(0);

  const fetchPage = useCallback(async (p) => {
    const seq = ++seqRef.current;
    try {
      if (p === 1) {
        setLoading(true);
        setError(false);
      } else setLoadingMore(true);
      const res = await api.get("/news", { params: { page: p, limit: LIMIT } });
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      if (seq !== seqRef.current) return;
      const list = Array.isArray(data) ? data : data?.items || [];
      const meta = data?.meta || res.data.meta || {};
      setItems((prev) => (p === 1 ? dedupe(list) : dedupe([...prev, ...list])));
      setPage(p);
      setTotalPages(meta.totalPages || 1);
    } catch {
      if (seq !== seqRef.current) return;
      if (p === 1) setError(true);
    } finally {
      if (seq === seqRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => fetchPage(1), 0);
    return () => clearTimeout(id);
  }, [fetchPage]);

  const openItem = (item) => {
    setTarget(item);
    if (!item.read) {
      setItems((prev) => prev.map((x) => (x._id === item._id ? { ...x, read: true } : x)));
      dp(markNewsRead(item._id, true));
    }
  };

  const markAll = () => {
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    dp(markAllNewsRead());
  };

  // ── Jonli yangilanish (store'ni useNewsSync yuritadi, bu — faqat ro'yxat) ──
  useSocketEvent("news:new", (p) => {
    if (!p?.news?._id || !audienceMatches(p.audience, authType)) return;
    setItems((prev) => dedupe([{ ...p.news, read: false }, ...prev]));
  });
  useSocketEvent("news:updated", (p) => {
    if (!p?.news?._id) return;
    if (!audienceMatches(p.audience, authType)) {
      setItems((prev) => prev.filter((x) => x._id !== p.news._id));
      return;
    }
    setItems((prev) => prev.map((x) => (x._id === p.news._id ? { ...x, ...p.news, read: x.read } : x)));
    setTarget((cur) => (cur?._id === p.news._id ? { ...cur, ...p.news, read: cur.read } : cur));
  });
  useSocketEvent("news:removed", (p) => {
    if (!p?.id) return;
    setItems((prev) => prev.filter((x) => x._id !== p.id));
    setTarget((cur) => (cur?._id === p.id ? null : cur));
  });
  useSocketEvent("news:read", (p) => {
    if (p?.all) setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    else if (p?.id) setItems((prev) => prev.map((x) => (x._id === p.id ? { ...x, read: true } : x)));
  });
  // Uzilish paytida o'tkazib yuborilganlar uchun ro'yxat qayta olinadi.
  useSocketEvent("connect", () => fetchPage(1));

  return (
    <div className="flex flex-col gap-1 p-5 sm:p-6 rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-3 pb-4 flex-wrap">
        <p className="font-semibold text-slate-800">
          {t("news.title")}
          {unread > 0 && <span className="ml-1.5 text-sm font-medium text-slate-400 tabular-nums">({unread})</span>}
        </p>
        {unread > 0 && (
          <Button color="blue" variant="text" className="gap-1 !px-0 normal-case text-xs" onClick={markAll}>
            <HiCheck />
            {t("news.markAllReadShort")}
          </Button>
        )}
      </div>

      {loading ? (
        <Loading height="20vh" />
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-3 h-[300px] text-center px-4">
          <span className="flex items-center justify-center w-14 h-14 rounded-2xl bg-red-50 text-2xl text-red-300">
            <HiExclamationCircle />
          </span>
          <p className="text-sm font-medium text-slate-500">{t("news.loadError")}</p>
          <Button variant="outlined" color="slate" onClick={() => fetchPage(1)}>
            {t("common.retry")}
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 h-[300px] text-center px-4">
          <span className="flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-50 text-2xl text-slate-300">
            <HiNewspaper />
          </span>
          <p className="text-sm font-medium text-slate-500">{t("news.empty")}</p>
          <p className="text-xs text-slate-400 max-w-xs">{t("news.emptySubtitle")}</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col divide-y divide-slate-100">
            {items.map((item) => (
              <NewsItem key={item._id} item={item} onOpen={openItem} />
            ))}
          </div>
          {page < totalPages && (
            <div className="flex justify-center pt-3">
              <Button
                color="slate"
                variant="outlined"
                loading={loadingMore}
                disabled={loadingMore}
                onClick={() => fetchPage(page + 1)}
              >
                {t("news.loadMore")}
              </Button>
            </div>
          )}
        </>
      )}

      {view && (
        <NewsDialog
          open={!!target}
          news={view}
          onClose={() => setTarget(null)}
          onInternalNavigate={() => setTarget(null)}
        />
      )}
    </div>
  );
}

export default NewsTab;
