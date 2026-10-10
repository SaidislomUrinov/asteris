import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiArrowDown, HiArrowUp, HiPlayCircle, HiTrash } from "react-icons/hi2";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import Button from "../../ui/Button";
import IconButton from "../../ui/IconButton";
import Input from "../../ui/Input";
import Loading from "../../ui/Loading";
import { CLIENT_SECTION_GROUPS, CLIENT_SECTIONS, clientGroupLabelKey } from "../../utils/clientSections";

const TITLE_MAX = 120;

// API massiv qaytaradi (tartib bo'yicha) — docs/API_CONTRACT_tutorial_videos_v2.md § 3.
const sectionByKey = (key) => CLIENT_SECTIONS.find((section) => section.key === key);

function VideoRow({ section, video, onSaved, onDeleted }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState(video?.youtubeUrl || "");
  const [title, setTitle] = useState(video?.title || "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const save = async () => {
    try {
      if (!url.trim()) throw new Error("tutorialVideo.urlRequired");
      setSaving(true);
      // sectionKey ba'zan "/" bilan keladi (masalan groups/detail) — Express
      // `:sectionKey` uni ikkita segment deb tushunmasligi uchun kodlanadi.
      const res = await api.put(`/tutorial-videos/${encodeURIComponent(section.key)}`, {
        youtubeUrl: url.trim(),
        title: title.trim(),
      });
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      onSaved(data);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      setDeleting(true);
      const res = await api.delete(`/tutorial-videos/${encodeURIComponent(section.key)}`);
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      setUrl("");
      setTitle("");
      onDeleted(section.key);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="grid grid-cols-[auto_1fr] lg:grid-cols-[2.25rem_13rem_1fr_1fr_15rem] items-center gap-x-3 gap-y-2 px-4 py-3">
      <div
        className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center ${
          video ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-400"
        }`}
      >
        <HiPlayCircle />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="font-medium text-slate-800 truncate">{t(section.labelKey)}</span>
        <span className="text-[12px] text-slate-400 truncate">/{section.key}</span>
      </div>
      <div className="col-span-2 lg:col-span-1 min-w-0">
        <Input
          placeholder={t("tutorialVideo.titlePlaceholder")}
          value={title}
          maxLength={TITLE_MAX}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="col-span-2 lg:col-span-1 min-w-0">
        <Input placeholder={t("tutorialVideo.placeholder")} value={url} onChange={(e) => setUrl(e.target.value)} />
      </div>
      <div className="col-span-2 lg:col-span-1 flex items-center gap-2">
        <Button loading={saving} onClick={save} disabled={deleting}>
          {t("common.save")}
        </Button>
        {video && (
          <Button color="red" variant="text" loading={deleting} onClick={remove} disabled={saving}>
            <HiTrash />
            {t("common.delete")}
          </Button>
        )}
      </div>
    </div>
  );
}

// Client "Video qo'llanmalar" sahifasidagi tartib — ↑/↓ bosilganda darhol saqlanadi.
function OrderPanel({ videos, onReordered }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const move = async (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= videos.length) return;
    const next = [...videos];
    [next[index], next[target]] = [next[target], next[index]];
    try {
      setBusy(true);
      const res = await api.patch("/tutorial-videos/order", { keys: next.map((v) => v.sectionKey) });
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      onReordered(data);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5 px-1">
        <span className="text-[12px] font-semibold uppercase tracking-wider text-slate-500">
          {t("tutorialVideo.orderTitle")}
        </span>
        <span className="text-[12px] text-slate-400">{t("tutorialVideo.orderHint")}</span>
      </div>
      <div className="flex flex-col divide-y divide-slate-100 bg-white border border-slate-200 rounded-xl overflow-hidden">
        {videos.map((video, index) => {
          const section = sectionByKey(video.sectionKey);
          return (
            <div key={video.sectionKey} className="flex items-center gap-3 px-4 py-2.5">
              <span className="inline-flex items-center justify-center min-w-8 h-6 px-1.5 shrink-0 rounded-md bg-blue-50 text-[13px] font-semibold text-blue-600 tabular-nums">#{index + 1}</span>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="font-medium text-slate-800 truncate">
                  {video.title || (section ? t(section.labelKey) : video.sectionKey)}
                </span>
                <span className="text-[12px] text-slate-400 truncate">
                  {section ? t(section.labelKey) : ""} · /{video.sectionKey}
                </span>
              </div>
              <IconButton
                variant="text"
                disabled={busy || index === 0}
                onClick={() => move(index, -1)}
                aria-label={t("tutorialVideo.moveUp")}
                title={t("tutorialVideo.moveUp")}
              >
                <HiArrowUp />
              </IconButton>
              <IconButton
                variant="text"
                disabled={busy || index === videos.length - 1}
                onClick={() => move(index, 1)}
                aria-label={t("tutorialVideo.moveDown")}
                title={t("tutorialVideo.moveDown")}
              >
                <HiArrowDown />
              </IconButton>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function TutorialVideos() {
  const { t } = useTranslation();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const res = await api.get("/tutorial-videos");
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setVideos(Array.isArray(data) ? data : []);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(fetchVideos, 0);
    return () => clearTimeout(timeout);
  }, []);

  // Yangi video oxiriga tushadi (server order = max+1), mavjudi joyida yangilanadi.
  const handleSaved = (saved) =>
    setVideos((prev) =>
      prev.some((v) => v.sectionKey === saved.sectionKey)
        ? prev.map((v) => (v.sectionKey === saved.sectionKey ? saved : v))
        : [...prev, saved],
    );
  const handleDeleted = (key) => setVideos((prev) => prev.filter((v) => v.sectionKey !== key));

  const videoOf = (key) => videos.find((v) => v.sectionKey === key);
  const filled = CLIENT_SECTIONS.filter((section) => videoOf(section.key)).length;

  return (
    <div className="flex flex-col w-full gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 w-full">
        <div className="flex flex-col gap-0.5">
          <p className="text-[18px] font-semibold text-slate-800">{t("tutorialVideo.title")}</p>
          <p className="text-[13px] text-slate-400">{t("tutorialVideo.hint")}</p>
        </div>
        {!loading && (
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-[13px] font-semibold text-slate-600 tabular-nums">
            {t("tutorialVideo.filled", { count: filled, total: CLIENT_SECTIONS.length })}
          </span>
        )}
      </div>

      {loading ? (
        <Loading height="40vh" />
      ) : (
        <>
          {videos.length > 1 && <OrderPanel videos={videos} onReordered={setVideos} />}
          {/* Bo'limlar client menyusi tuzilishi bo'yicha guruhlangan (utils/clientSections.js). */}
          {CLIENT_SECTION_GROUPS.map(({ group }) => {
            const sections = CLIENT_SECTIONS.filter((section) => section.group === group);
            const groupFilled = sections.filter((section) => videoOf(section.key)).length;
            return (
              <section key={group} className="flex flex-col gap-2">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-[12px] font-semibold uppercase tracking-wider text-slate-500">
                    {t(clientGroupLabelKey(group))}
                  </span>
                  <span className="text-[12px] font-semibold text-slate-400 tabular-nums">
                    {groupFilled}/{sections.length}
                  </span>
                </div>
                <div className="flex flex-col divide-y divide-slate-100 bg-white border border-slate-200 rounded-xl overflow-hidden">
                  {sections.map((section) => (
                    <VideoRow
                      key={section.key}
                      section={section}
                      video={videoOf(section.key)}
                      onSaved={handleSaved}
                      onDeleted={handleDeleted}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
