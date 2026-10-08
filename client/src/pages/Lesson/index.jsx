import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiCalendarDays, HiUserGroup } from "react-icons/hi2";
import Button from "../../ui/Button";
import Loading from "../../ui/Loading";
import GroupDetail from "../Groups/GroupDetail";
import { api } from "../../utils/fetching";
import { errorMsg } from "../../utils/alert";

// O'qituvchi/Yordamchining "Dars" sahifasi — faqat QAYSI guruh ekanini
// aniqlaydi (`/teacher/current-lesson`) va guruh detalini o'sha guruh bilan
// chizadi. Avval GroupDetail'ning ~870 qatorli nusxasi edi va har o'zgarish
// ikki joyga kiritilardi (docs/API_CONTRACT_lesson_merge.md).
function Lesson() {
  const { t } = useTranslation();
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchLesson = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await api.get("/teacher/current-lesson");
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setLesson(data);
    } catch (error) {
      setError(true);
      errorMsg(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(fetchLesson, 0);
    return () => clearTimeout(id);
  }, [fetchLesson]);

  if (loading) return <Loading height="40vh" />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center w-full flex-1 gap-3 text-slate-400 dark:text-slate-500">
        <HiUserGroup className="text-4xl" />
        <p className="text-sm">{t("lesson.error")}</p>
        <Button variant="outlined" onClick={fetchLesson}>
          {t("common.retry")}
        </Button>
      </div>
    );
  }

  const groupId = lesson?.group?._id;

  if (!groupId) {
    return (
      <div className="flex flex-col w-full h-full items-center justify-center gap-2 py-10 px-4 text-center">
        <span className="flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-50 dark:bg-night-800 text-2xl text-slate-300 dark:text-slate-600">
          <HiCalendarDays />
        </span>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{t("lesson.emptyState")}</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs">{t("lesson.emptyHint")}</p>
      </div>
    );
  }

  // `key` — dars boshqa guruhga almashsa detal holati (tab, saralash) tozalanadi.
  return <GroupDetail key={groupId} groupId={groupId} live />;
}

export default Lesson;
