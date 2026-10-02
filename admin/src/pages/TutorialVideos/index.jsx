import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiPlayCircle, HiTrash } from "react-icons/hi2";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import Button from "../../ui/Button";
import Input from "../../ui/Input";
import Loading from "../../ui/Loading";

// 22 ta bo'lim — sectionKey `client/src/utils/navSections.js` dagi
// NAV_SECTIONS bilan bir xil manbaga tayanadi (docs/API_CONTRACT_tutorial_videos.md).
// eslint-disable-next-line react-refresh/only-export-components -- katalog shu faylning o'zida (kontrakt talabi)
export const SECTION_CATALOG = [
  { key: "dashboard", labelKey: "tutorialVideo.sections.dashboard" },
  { key: "centers", labelKey: "tutorialVideo.sections.centers" },
  { key: "staff", labelKey: "tutorialVideo.sections.staff" },
  { key: "subjects", labelKey: "tutorialVideo.sections.subjects" },
  { key: "rooms", labelKey: "tutorialVideo.sections.rooms" },
  { key: "groups", labelKey: "tutorialVideo.sections.groups" },
  { key: "schedule", labelKey: "tutorialVideo.sections.schedule" },
  { key: "calendar", labelKey: "tutorialVideo.sections.calendar" },
  { key: "lesson", labelKey: "tutorialVideo.sections.lesson" },
  { key: "students", labelKey: "tutorialVideo.sections.students" },
  { key: "leads", labelKey: "tutorialVideo.sections.leads" },
  { key: "qr-attendance", labelKey: "tutorialVideo.sections.qrAttendance" },
  { key: "salary", labelKey: "tutorialVideo.sections.salary" },
  { key: "expenses", labelKey: "tutorialVideo.sections.expenses" },
  { key: "revenue", labelKey: "tutorialVideo.sections.revenue" },
  { key: "subscription", labelKey: "tutorialVideo.sections.subscription" },
  { key: "notifications", labelKey: "tutorialVideo.sections.notifications" },
  { key: "profile", labelKey: "tutorialVideo.sections.profile" },
  { key: "finance", labelKey: "tutorialVideo.sections.finance" },
  { key: "reports/teacher-performance", labelKey: "tutorialVideo.sections.teacherPerformance" },
  { key: "certificates", labelKey: "tutorialVideo.sections.certificates" },
  { key: "archive", labelKey: "tutorialVideo.sections.archive" },
];

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
      <div className="w-9 h-9 shrink-0 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center">
        <HiPlayCircle />
      </div>
      <div className="flex flex-col min-w-0 w-40 shrink-0">
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

  return (
    <div className="flex flex-col w-full gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 w-full">
        <p className="text-[18px] font-semibold text-slate-800">{t("tutorialVideo.title")}</p>
      </div>

      {loading ? (
        <Loading height="40vh" />
      ) : (
        <div className="flex flex-col divide-y divide-slate-100 bg-white border border-slate-200 rounded-xl overflow-x-auto">
          {SECTION_CATALOG.map((section) => (
            <VideoRow
              key={section.key}
              section={section}
              url={videos[section.key]}
              onSaved={handleSaved}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}
    </div>
  );
}
