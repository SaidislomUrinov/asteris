import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { HiExclamationTriangle, HiPlus, HiQuestionMarkCircle, HiRectangleStack } from "react-icons/hi2";
import Button from "../../ui/Button";
import PlanCard from "./PlanCard";
import PlanCardSkeleton from "./PlanCardSkeleton";
import PlanFormDialog from "./PlanFormDialog";
import QuizTemplatesTab from "./QuizTemplatesTab";
import GroupSectionTabs from "../Groups/GroupSectionTabs";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { api } from "../../utils/fetching";
import useFeature from "../../hooks/useFeature";

const SKELETON_COUNT = 6;

/**
 * "Dars rejalarim" — o'qituvchining shablon rejalari ro'yxati
 * (API_CONTRACT_teaching_plans.md §6). Faqat teacher/assistant +
 * `lesson.planning` tarif flagi (App.jsx marshrut qo'riqchisi).
 */
function MyPlans() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const hasFeature = useFeature();
  // "Testlar" tabi faqat tarif `quiz.manage` flagini ochganda ko'rinadi
  // (GroupDetail.jsx `canQuiz` bilan bir xil naqsh).
  const canQuizTemplates = hasFeature("quiz.manage");
  const [activeTab, setActiveTab] = useState("plans"); // plans | quiz

  const [plans, setPlans] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [subject, setSubject] = useState(""); // "" = Barchasi
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);

  const fetchPlans = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (!silent) setLoading(true);
        setError("");
        const res = await api.get("/teaching-plans", {
          params: subject ? { subject } : {},
        });
        const { ok, data, msg } = res.data;
        if (!ok) throw new Error(msg);
        setPlans(data || []);
      } catch (err) {
        setError(err.message || "teachingPlan.loadError");
      } finally {
        setLoading(false);
      }
    },
    [subject],
  );

  const fetchSubjects = useCallback(async () => {
    try {
      const res = await api.get("/teaching-plans/subjects");
      const { ok, data } = res.data;
      if (ok) setSubjects(data || []);
    } catch {
      // fanlar faqat filtr/tanlov uchun — xato bo'lsa chiplar ko'rinmaydi
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(fetchPlans, 0);
    return () => clearTimeout(id);
  }, [fetchPlans]);

  useEffect(() => {
    const id = setTimeout(fetchSubjects, 0);
    return () => clearTimeout(id);
  }, [fetchSubjects]);

  // Boshqa qurilmada reja o'zgarsa ro'yxat jonli yangilanadi.
  useSocketEvent("teachingPlan:changed", () => fetchPlans({ silent: true }));

  const openCreate = () => {
    setDialogKey((k) => k + 1);
    setCreateOpen(true);
  };

  const chips = [{ _id: "", name: t("common.all") }, ...subjects];

  const renderBody = () => {
    if (loading) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <PlanCardSkeleton key={i} />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col flex-1 items-center justify-center gap-2 py-12 text-center">
          <span className="flex items-center justify-center w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-500/15 text-2xl text-red-400">
            <HiExclamationTriangle />
          </span>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{t("teachingPlan.loadError")}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">{t(error)}</p>
          <Button variant="outlined" color="black" onClick={() => fetchPlans()}>
            {t("common.retry")}
          </Button>
        </div>
      );
    }

    if (plans.length === 0) {
      return (
        <div className="flex flex-col flex-1 items-center justify-center gap-2 py-12 text-center">
          <span className="flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-50 dark:bg-night-800 text-2xl text-slate-300 dark:text-slate-600">
            <HiRectangleStack />
          </span>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            {subject ? t("teachingPlan.emptyFiltered") : t("teachingPlan.empty")}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs">{t("teachingPlan.emptyHint")}</p>
          <Button className="gap-1.5 mt-1" onClick={openCreate}>
            <HiPlus className="text-base" />
            {t("teachingPlan.new")}
          </Button>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {plans.map((plan) => (
          <PlanCard key={plan._id} plan={plan} />
        ))}
      </div>
    );
  };

  const tabs = [
    { key: "plans", label: t("teachingPlan.tab"), icon: HiRectangleStack },
    canQuizTemplates && { key: "quiz", label: t("quiz.template.tab"), icon: HiQuestionMarkCircle },
  ].filter(Boolean);

  return (
    <div className="flex flex-col w-full h-full gap-4">
      {canQuizTemplates && <GroupSectionTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />}

      {activeTab === "plans" ? (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 shadow-sm dark:shadow-none shadow-slate-900/[0.02]">
            {/* Fan filtri — chiplar, ko'p bo'lsa keyingi qatorga o'tadi. */}
            <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
              {subjects.length > 0 &&
                chips.map((s) => {
                  const active = subject === s._id;
                  return (
                    <button
                      key={s._id || "all"}
                      type="button"
                      onClick={() => setSubject(s._id)}
                      className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                        active
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 dark:bg-night-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-night-700"
                      }`}
                    >
                      {s.name}
                    </button>
                  );
                })}
            </div>

            {/* Mobilda alohida qatorda — chiplarni kesib qo'ymasligi uchun. */}
            <div className="sm:ml-auto shrink-0">
              <Button onClick={openCreate} className="gap-1.5 w-full sm:w-auto">
                <HiPlus className="text-base" />
                {t("teachingPlan.new")}
              </Button>
            </div>
          </div>

          {renderBody()}

          <PlanFormDialog
            key={dialogKey}
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            subjects={subjects}
            defaultSubject={subject}
            onSaved={(plan) => plan?._id && navigate(`/my-plans/${plan._id}`)}
          />
        </>
      ) : (
        <QuizTemplatesTab subjects={subjects} subject={subject} />
      )}
    </div>
  );
}

export default MyPlans;
