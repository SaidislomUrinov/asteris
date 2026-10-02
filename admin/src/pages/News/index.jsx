import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  HiPlus,
  HiMagnifyingGlass,
  HiPencilSquare,
  HiPaperAirplane,
  HiTrash,
  HiPlay,
  HiFilm,
  HiNewspaper,
  HiExclamationTriangle,
} from "react-icons/hi2";
import { deleteNews, fetchNewsList, publishNews } from "../../api/news";
import { errorMsg, successMsg } from "../../utils/alert";
import socket from "../../socket";
import Button from "../../ui/Button";
import IconButton from "../../ui/IconButton";
import Input from "../../ui/Input";
import Select from "../../ui/Select";
import List from "../../ui/List";
import Dialog from "../../ui/Dialog";
import PublishDialog from "./PublishDialog";
import { LEVEL_TONES, STATUSES, STATUS_TONES, coverOf, formatDateTime } from "./newsMeta";

const LIMIT = 20;

function Cover({ media }) {
  const cover = coverOf(media);
  return (
    <div className="relative w-20 aspect-video shrink-0 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center text-slate-300">
      {!cover && <HiNewspaper size={20} />}
      {cover?.kind === "image" && <img src={cover.src} alt="" className="w-full h-full object-cover" />}
      {cover?.kind === "youtube" && (
        <>
          <img src={cover.src} alt="" className="w-full h-full object-cover" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-red-600 text-white">
              <HiPlay size={12} />
            </span>
          </span>
        </>
      )}
      {cover?.kind === "video" && (
        <span className="flex items-center justify-center w-full h-full bg-slate-800 text-white/80">
          <HiFilm size={20} />
        </span>
      )}
    </div>
  );
}

function ReadProgress({ item }) {
  const { t } = useTranslation();
  if (item.status !== "published") return <span className="text-slate-300">—</span>;
  const read = Number(item.readCount || 0);
  const total = Number(item.audienceCount || 0);
  const pct = total > 0 ? Math.min(100, Math.round((read / total) * 100)) : 0;
  return (
    <div className="flex flex-col gap-1 w-36">
      <div className="flex items-center justify-between text-[12px]">
        <span className="font-semibold text-slate-700 tabular-nums">
          {t("news.readsOf", { read, total })}
        </span>
        <span className="text-slate-400 tabular-nums">{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function News() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [publishTarget, setPublishTarget] = useState(null);
  const [publishLoading, setPublishLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const isSearching = !!search.trim();

  const fetchNews = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (!silent) setLoading(true);
        setLoadError(false);
        const params = { page, limit: LIMIT };
        if (search.trim()) params.search = search.trim();
        if (status !== "all") params.status = status;
        const res = await fetchNewsList(params);
        const { ok, data, msg } = res.data;
        if (!ok) throw new Error(msg);
        // Kontrakt: `data: { items, meta }`; ba'zi admin endpointlari
        // `data: [...]` + yuqori darajadagi `meta` qaytaradi — ikkalasi ham.
        const list = Array.isArray(data) ? data : data?.items || [];
        const m = res.data.meta || data?.meta || { page, total: list.length, totalPages: 1 };
        setItems(list);
        setMeta(m);
      } catch (error) {
        if (!silent) {
          setLoadError(true);
          errorMsg(error.response?.data?.msg || error.message);
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [page, search, status],
  );

  useEffect(() => {
    const timeout = setTimeout(fetchNews, isSearching ? 350 : 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, status]);

  // Realtime: o'qilganlik/yangi yangilik — `news:changed` → jimgina qayta yuklash.
  // Ketma-ket kelgan hodisalar bitta so'rovga yig'iladi.
  const fetchRef = useRef(fetchNews);
  useEffect(() => {
    fetchRef.current = fetchNews;
  });
  useEffect(() => {
    let timer = null;
    const onChanged = () => {
      clearTimeout(timer);
      timer = setTimeout(() => fetchRef.current({ silent: true }), 600);
    };
    socket.on("news:changed", onChanged);
    return () => {
      clearTimeout(timer);
      socket.off("news:changed", onChanged);
    };
  }, []);

  const confirmPublish = async () => {
    try {
      setPublishLoading(true);
      const res = await publishNews(publishTarget._id);
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg("news.toast.published");
      setPublishTarget(null);
      fetchNews({ silent: true });
    } catch (error) {
      errorMsg(error.response?.data?.msg || error.message);
    } finally {
      setPublishLoading(false);
    }
  };

  const confirmDelete = async () => {
    try {
      setDeleteLoading(true);
      const res = await deleteNews(deleteTarget._id);
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg("news.toast.deleted");
      setItems((prev) => prev.filter((n) => n._id !== deleteTarget._id));
      setDeleteTarget(null);
      fetchNews({ silent: true });
    } catch (error) {
      errorMsg(error.response?.data?.msg || error.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const statusOptions = [
    { value: "all", label: t("news.statusAll") },
    ...STATUSES.map((s) => ({ value: s, label: t(`news.status.${s}`) })),
  ];

  const columns = [
    {
      key: "news",
      header: t("news.col.news"),
      render: (n) => (
        <button
          type="button"
          onClick={() => navigate(`/news/${n._id}`)}
          className="flex items-center gap-3 text-left cursor-pointer group max-w-md"
        >
          <Cover media={n.media} />
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-slate-800 truncate group-hover:underline">{n.title}</span>
            <span className="text-[12px] text-slate-400">{t(`news.audience.${n.audience || "all"}`)}</span>
          </div>
        </button>
      ),
    },
    {
      key: "level",
      header: t("news.col.level"),
      render: (n) => {
        const tone = LEVEL_TONES[n.level] || LEVEL_TONES.important;
        return (
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-semibold uppercase ${tone.chip}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
            {t(`news.level.${n.level || "important"}`)}
          </span>
        );
      },
    },
    {
      key: "status",
      header: t("news.col.status"),
      render: (n) => (
        <span className={`inline-flex px-2 py-0.5 rounded-lg text-[11px] font-semibold uppercase ${STATUS_TONES[n.status] || STATUS_TONES.draft}`}>
          {t(`news.status.${n.status || "draft"}`)}
        </span>
      ),
    },
    {
      key: "reads",
      header: t("news.col.reads"),
      render: (n) => <ReadProgress item={n} />,
    },
    {
      key: "date",
      header: t("news.col.date"),
      render: (n) => (
        <div className="flex flex-col text-[12px]">
          <span className="text-slate-700 tabular-nums">
            {formatDateTime(n.publishedAt || n.createdAt)}
          </span>
          <span className="text-slate-400">
            {n.publishedAt ? t("news.sentAt") : t("news.createdAt")}
          </span>
        </div>
      ),
    },
    {
      key: "actions",
      header: t("common.actions"),
      className: "text-right",
      render: (n) => (
        <div className="flex items-center justify-end gap-1">
          {n.status !== "published" && (
            <IconButton
              variant="ghost"
              color="emerald"
              title={t("news.publish")}
              onClick={() => setPublishTarget(n)}
            >
              <HiPaperAirplane />
            </IconButton>
          )}
          <IconButton variant="ghost" title={t("common.edit")} onClick={() => navigate(`/news/${n._id}`)}>
            <HiPencilSquare />
          </IconButton>
          <IconButton variant="ghost" color="red" title={t("common.delete")} onClick={() => setDeleteTarget(n)}>
            <HiTrash />
          </IconButton>
        </div>
      ),
    },
  ];

  const filtered = isSearching || status !== "all";

  const emptyState = loadError ? (
    <div className="flex flex-col items-center gap-2">
      <HiExclamationTriangle className="text-[28px] text-red-400" />
      <span>{t("news.loadError")}</span>
      <Button color="slate" variant="ghost" onClick={() => fetchNews()}>
        {t("common.retry")}
      </Button>
    </div>
  ) : filtered ? (
    <span>{t("news.emptySearch")}</span>
  ) : (
    <div className="flex flex-col items-center gap-2 text-center">
      <HiNewspaper className="text-[32px] text-slate-300" />
      <span className="font-medium text-slate-600">{t("news.empty")}</span>
      <span className="text-[12px]">{t("news.emptyHint")}</span>
    </div>
  );

  return (
    <div className="flex flex-col w-full h-full gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 w-full">
        <p className="text-[18px] font-semibold text-slate-800">
          {t("news.title")}{" "}
          <span className="text-slate-400 text-sm font-normal">({meta?.total ?? items.length})</span>
        </p>
        <Button onClick={() => navigate("/news/new")}>
          <HiPlus className="text-base" />
          {t("news.new")}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 w-full">
        <div className="flex-1 min-w-56">
          <Input
            variant="white"
            icon={<HiMagnifyingGlass />}
            placeholder={t("news.searchPlaceholder")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="w-full sm:w-52">
          <Select
            variant="white"
            value={status}
            options={statusOptions}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          />
        </div>
      </div>

      <List
        columns={columns}
        rows={loadError ? [] : items}
        loading={loading}
        empty={emptyState}
        page={meta?.page || page}
        totalPages={meta?.totalPages || 1}
        onPageChange={setPage}
        showPagination
      />

      <PublishDialog
        open={!!publishTarget}
        title={publishTarget?.title}
        audience={publishTarget?.audience}
        loading={publishLoading}
        onClose={() => setPublishTarget(null)}
        onConfirm={confirmPublish}
      />

      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t("news.deleteTitle")}
        actions={
          <>
            <Button color="slate" variant="text" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button color="red" loading={deleteLoading} onClick={confirmDelete}>
              {t("common.delete")}
            </Button>
          </>
        }
      >
        <p className="text-slate-700 text-sm">
          {t("news.deleteConfirm", { title: deleteTarget?.title || "" })}
        </p>
      </Dialog>
    </div>
  );
}
