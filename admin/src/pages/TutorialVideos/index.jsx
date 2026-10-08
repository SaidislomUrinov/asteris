import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiPlayCircle, HiTrash } from "react-icons/hi2";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import Button from "../../ui/Button";
import Input from "../../ui/Input";
import Loading from "../../ui/Loading";
import { CLIENT_SECTION_GROUPS, CLIENT_SECTIONS, clientGroupLabelKey } from "../../utils/clientSections";


function VideoRow({ section, url, onSaved, onDeleted }) {
  const { t } = useTranslation();
  const [value, setValue] = useState(url || "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const save = async () => {
    try {
      if (!value.trim()) throw new Error("tutorialVideo.urlRequired");
      setSaving(true);
      // sectionKey ba'zan "/" bilan keladi (masalan reports/teacher-performance)
      // — Express `:sectionKey` uni ikkita segment deb tushunib qolmasligi
      // uchun kodlab yuboriladi.
      const res = await api.put(`/tutorial-videos/${encodeURIComponent(section.key)}`, {
        youtubeUrl: value.trim(),
      });
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      onSaved(section.key, data.youtubeUrl);
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
      setValue("");
      onDeleted(section.key);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div
        className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center ${
          url ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-400"
        }`}
      >
        <HiPlayCircle />
      </div>
      <div className="flex flex-col min-w-0 w-56 shrink-0">
        <span className="font-medium text-slate-800 truncate">{t(section.labelKey)}</span>
        <span className="text-[12px] text-slate-400 truncate">/{section.key}</span>
      </div>
      <div className="flex-1 min-w-50">
        <Input
          placeholder={t("tutorialVideo.placeholder")}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      <Button loading={saving} onClick={save} disabled={deleting}>
        {t("common.save")}
      </Button>
      {url && (
        <Button color="red" variant="text" loading={deleting} onClick={remove} disabled={saving}>
          <HiTrash />
          {t("common.delete")}
        </Button>
      )}
    </div>
  );
}

export default function TutorialVideos() {
  const { t } = useTranslation();
  const [videos, setVideos] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const res = await api.get("/tutorial-videos");
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setVideos(data || {});
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

  const handleSaved = (key, url) => setVideos((prev) => ({ ...prev, [key]: url }));
  const handleDeleted = (key) =>
    setVideos((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const filled = CLIENT_SECTIONS.filter((section) => videos[section.key]).length;

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
        // Bo'limlar client menyusi tuzilishi bo'yicha guruhlangan (utils/clientSections.js).
        CLIENT_SECTION_GROUPS.map(({ group }) => {
          const sections = CLIENT_SECTIONS.filter((section) => section.group === group);
          const groupFilled = sections.filter((section) => videos[section.key]).length;
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
              <div className="flex flex-col divide-y divide-slate-100 bg-white border border-slate-200 rounded-xl overflow-x-auto">
                {sections.map((section) => (
                  <VideoRow
                    key={section.key}
                    section={section}
                    url={videos[section.key]}
                    onSaved={handleSaved}
                    onDeleted={handleDeleted}
                  />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
