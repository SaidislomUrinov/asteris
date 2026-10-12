import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  HiArrowLeft,
  HiClipboardDocumentList,
  HiDocumentDuplicate,
  HiExclamationTriangle,
  HiPencilSquare,
  HiPlus,
  HiArchiveBox,
  HiArrowUpTray,
  HiTrash,
} from "react-icons/hi2";
import Button from "../../ui/Button";
import IconButton from "../../ui/IconButton";
import Input from "../../ui/Input";
import Dialog from "../../ui/Dialog";
import DropMenu from "../../ui/DropMenu";
import SyllabusDialog from "../Groups/SyllabusDialog";
import PlanFormDialog from "./PlanFormDialog";
import PlanModuleCard from "./PlanModuleCard";
import PlanImportDialog from "./PlanImportDialog";
import { countLessons, formatPlanDate, moveItem, serializeModules } from "./planUtils";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import useFeature from "../../hooks/useFeature";
import useMediaQuery from "../../hooks/useMediaQuery";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";

/**
 * Reja muharriri `/my-plans/:id` (API_CONTRACT_teaching_plans.md §6).
 * Har amal butun daraxtni `PUT /teaching-plans/:id { modules }` bilan
 * saqlaydi (full replace) — SyllabusTab bilan bir xil naqsh.
 */
function PlanEditor() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const hasFeature = useFeature();
  const showHomework = hasFeature("homework.manage");
  const wide = useMediaQuery("(min-width: 640px)");

  const [plan, setPlan] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  // Yoyilgan modullar — reja bo'yicha (nusxaga o'tganda eski holat qolmaydi).
  const [openState, setOpenState] = useState({ planId: null, ids: null });
  // O'zimiz saqlayotganda kelgan `teachingPlan:changed` dan qayta yuklamaslik.
  const pendingSaves = useRef(0);

  const [moduleDialog, setModuleDialog] = useState(null); // { module | null }
  const [moduleTitle, setModuleTitle] = useState("");
  const [lessonDialog, setLessonDialog] = useState(null); // { lesson, moduleId }
  const [removeTarget, setRemoveTarget] = useState(null); // { kind, id, title }
  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false); // nusxa / o'chirish
  // Excel'dan import (docs/API_CONTRACT_teaching_plan_excel_import.md) —
  // `{ kind: "plan"|"lessons", moduleId }`; key har ochilishda oynani yangilaydi.
  const [importDialog, setImportDialog] = useState(null);
  const [importKey, setImportKey] = useState(0);
  const openImport = (kind, moduleId = null) => {
    setImportKey((k) => k + 1);
    setImportDialog({ kind, moduleId });
  };

  const modules = useMemo(() => plan?.modules || [], [plan]);

  const fetchPlan = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (!silent) setLoading(true);
        setLoadError("");
        const res = await api.get(`/teaching-plans/${id}`);
        const { ok, data, msg } = res.data;
        if (!ok) throw new Error(msg);
        setPlan(data);
      } catch (error) {
        if (!silent) setLoadError(error.message || "teachingPlan.loadError");
      } finally {
        setLoading(false);
      }
    },
    [id],
  );

  const fetchSubjects = useCallback(async () => {
    try {
      const res = await api.get("/teaching-plans/subjects");
      const { ok, data } = res.data;
      if (ok) setSubjects(data || []);
    } catch {
      // faqat nom/fan tahriri dialogi uchun
    }
  }, []);

  useEffect(() => {
    const tid = setTimeout(fetchPlan, 0);
    return () => clearTimeout(tid);
  }, [fetchPlan]);

  useEffect(() => {
    const tid = setTimeout(fetchSubjects, 0);
    return () => clearTimeout(tid);
  }, [fetchSubjects]);

  useSocketEvent("teachingPlan:changed", (p) => {
    if (p?.planId && p.planId !== id) return;
    if (pendingSaves.current > 0) return;
    fetchPlan({ silent: true });
  });

  const startNo = useMemo(() => {
    const map = {};
    let no = 1;
    modules.forEach((m, i) => {
      map[m._id || `i-${i}`] = no;
      no += (m.lessons || []).length;
    });
    return map;
  }, [modules]);

  const defaultOpen = useMemo(() => (modules[0]?._id ? [modules[0]._id] : []), [modules]);
  const visibleOpen = (openState.planId === id && openState.ids) || defaultOpen;
  const toggleModule = (mid) =>
    setOpenState({
      planId: id,
      ids: visibleOpen.includes(mid) ? visibleOpen.filter((x) => x !== mid) : [...visibleOpen, mid],
    });

  // Butun daraxtni saqlash — barcha CRUD/ko'chirish shu orqali.
  const persist = async (nextModules, okMsg) => {
    pendingSaves.current += 1;
    try {
      setSaving(true);
      const res = await api.put(`/teaching-plans/${id}`, {
        modules: serializeModules(nextModules),
      });
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setPlan(data);
      if (okMsg !== false) successMsg(okMsg || msg || "teachingPlan.saved");
      return true;
    } catch (error) {
      errorMsg(error.message);
      return false;
    } finally {
      pendingSaves.current -= 1;
      setSaving(false);
    }
  };

  const openModuleDialog = (module = null) => {
    setModuleTitle(module?.title || "");
    setModuleDialog({ module });
  };

  const saveModule = async () => {
    const title = moduleTitle.trim();
    if (!title) return errorMsg("syllabus.titleRequired");
    const editing = moduleDialog.module;
    const next = editing
      ? modules.map((m) => (m._id === editing._id ? { ...m, title } : m))
      : [...modules, { _id: undefined, title, lessons: [] }];
    if (await persist(next)) setModuleDialog(null);
  };

  const saveLesson = async (form) => {
    const title = (form.title || "").trim();
    if (!title) return errorMsg("syllabus.titleRequired");
    if (!form.moduleId) return errorMsg("syllabus.moduleRequired");

    const editing = lessonDialog?.lesson;
    const payload = {
      title,
      description: form.description || "",
      homework: form.homework || "",
    };

    let next;
    if (editing) {
      const sameModule = modules.find((m) =>
        (m.lessons || []).some((l) => l._id === editing._id),
      )?._id === form.moduleId;
      next = sameModule
        ? // Modul o'zgarmasa — joyida yangilanadi (tartib saqlanadi).
          modules.map((m) => ({
            ...m,
            lessons: (m.lessons || []).map((l) =>
              l._id === editing._id ? { ...l, ...payload } : l,
            ),
          }))
        : modules
            .map((m) => ({
              ...m,
              lessons: (m.lessons || []).filter((l) => l._id !== editing._id),
            }))
            .map((m) =>
              m._id === form.moduleId
                ? { ...m, lessons: [...m.lessons, { ...editing, ...payload }] }
                : m,
            );
    } else {
      next = modules.map((m) =>
        m._id === form.moduleId
          ? { ...m, lessons: [...(m.lessons || []), { _id: undefined, ...payload }] }
          : m,
      );
    }
    if (await persist(next)) setLessonDialog(null);
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    const next =
      removeTarget.kind === "module"
        ? modules.filter((m) => m._id !== removeTarget.id)
        : modules.map((m) => ({
            ...m,
            lessons: (m.lessons || []).filter((l) => l._id !== removeTarget.id),
          }));
    if (await persist(next)) setRemoveTarget(null);
  };

  const moveModule = (index, delta) => {
    if (saving) return;
    const next = moveItem(modules, index, delta);
    if (next !== modules) persist(next, false);
  };

  const moveLesson = (moduleIndex, lessonIndex, delta) => {
    if (saving) return;
    const lessons = modules[moduleIndex].lessons || [];
    const moved = moveItem(lessons, lessonIndex, delta);
    if (moved === lessons) return;
    persist(
      modules.map((m, i) => (i === moduleIndex ? { ...m, lessons: moved } : m)),
      false,
    );
  };

  const duplicate = async () => {
    try {
      setBusy(true);
      const res = await api.post(`/teaching-plans/${id}/duplicate`);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg || "teachingPlan.duplicated");
      if (data?._id) navigate(`/my-plans/${data._id}`);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setBusy(false);
    }
  };

  const removePlan = async () => {
    try {
      setBusy(true);
      const res = await api.delete(`/teaching-plans/${id}`);
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg || "teachingPlan.deleted");
      setDeleteOpen(false);
      navigate("/my-plans", { replace: true });
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setBusy(false);
    }
  };

  const backLink = (
    <Link
      to="/my-plans"
      className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100"
    >
      <HiArrowLeft />
      {t("teachingPlan.back")}
    </Link>
  );

  if (loading) {
    return (
      <div className="flex flex-col w-full gap-4 animate-pulse">
        <span className="h-4 w-28 rounded bg-slate-100 dark:bg-night-800" />
        <div className="flex flex-col gap-2 p-4 rounded-2xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900">
          <span className="h-6 w-1/2 rounded bg-slate-100 dark:bg-night-800" />
          <span className="h-4 w-24 rounded bg-slate-100 dark:bg-night-800" />
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 rounded-xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900" />
        ))}
      </div>
    );
  }

  if (loadError || !plan) {
    return (
      <div className="flex flex-col w-full h-full gap-4">
        {backLink}
        <div className="flex flex-col flex-1 items-center justify-center gap-2 text-center">
          <span className="flex items-center justify-center w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-500/15 text-2xl text-red-400">
            <HiExclamationTriangle />
          </span>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{t("teachingPlan.loadError")}</p>
          {loadError && <p className="text-xs text-slate-400 dark:text-slate-500">{t(loadError)}</p>}
          <Button variant="outlined" color="black" onClick={() => fetchPlan()}>
            {t("common.retry")}
          </Button>
        </div>
      </div>
    );
  }

  const lessonCount = countLessons(modules);

  return (
    <div className="flex flex-col w-full h-full gap-4">
      {backLink}

      {/* Sarlavha kartasi */}
      <div className="flex items-start gap-3 p-4 rounded-2xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 shadow-sm dark:shadow-none shadow-slate-900/[0.02]">
        <span className="flex items-center justify-center w-11 h-11 shrink-0 rounded-xl bg-blue-50 dark:bg-blue-500/15 text-xl text-blue-500">
          <HiClipboardDocumentList />
        </span>
        <div className="flex flex-col min-w-0 flex-1 gap-1.5">
          <h1 className="text-lg sm:text-xl font-semibold leading-snug tracking-tight text-slate-900 dark:text-slate-100 break-words">{plan.title}</h1>
          <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 dark:text-slate-400">
            {plan.subject?.name && (
              <span className="px-2 py-0.5 rounded-md bg-violet-50 dark:bg-violet-500/15 font-semibold text-violet-600 dark:text-violet-400">
                {plan.subject.name}
              </span>
            )}
            <span className="tabular-nums">
              {t("syllabus.importMeta", { modules: modules.length, lessons: lessonCount })}
            </span>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <span className="tabular-nums">
              {t("teachingPlan.updated", { date: formatPlanDate(plan.updatedAt) })}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {wide && (
            <>
              <IconButton
                variant="ghost"
                color="black"
                title={t("teachingPlan.editTitle")}
                onClick={() => {
                  setFormKey((k) => k + 1);
                  setFormOpen(true);
                }}
              >
                <HiPencilSquare />
              </IconButton>
              <IconButton
                variant="ghost"
                color="emerald"
                title={t("teachingPlan.import.button")}
                onClick={() => openImport("plan")}
              >
                <HiArrowUpTray />
              </IconButton>
              <IconButton
                variant="ghost"
                color="black"
                title={t("teachingPlan.duplicate")}
                loading={busy && !deleteOpen}
                onClick={duplicate}
              >
                <HiDocumentDuplicate />
              </IconButton>
              <IconButton
                variant="ghost"
                color="red"
                title={t("teachingPlan.delete")}
                onClick={() => setDeleteOpen(true)}
              >
                <HiArchiveBox />
              </IconButton>
            </>
          )}
          {!wide && (
            <DropMenu
              items={[
                {
                  label: t("teachingPlan.editTitle"),
                  icon: HiPencilSquare,
                  iconClass: "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400",
                  onClick: () => {
                    setFormKey((k) => k + 1);
                    setFormOpen(true);
                  },
                },
                {
                  label: t("teachingPlan.import.button"),
                  icon: HiArrowUpTray,
                  iconClass: "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                  onClick: () => openImport("plan"),
                },
                {
                  label: t("teachingPlan.duplicate"),
                  icon: HiDocumentDuplicate,
                  iconClass: "bg-slate-100 dark:bg-night-800 text-slate-600 dark:text-slate-300",
                  disabled: busy,
                  onClick: duplicate,
                },
                {
                  label: t("teachingPlan.delete"),
                  icon: HiArchiveBox,
                  iconClass: "bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400",
                  onClick: () => setDeleteOpen(true),
                },
              ]}
            />
          )}
        </div>
      </div>

      {/* Modullar */}
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {t("teachingPlan.modules")}
          <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-night-800 text-slate-500 dark:text-slate-400 tabular-nums">
            {modules.length}
          </span>
        </p>
        <Button variant="outlined" className="gap-1.5" onClick={() => openModuleDialog()}>
          <HiPlus className="text-base" />
          {t("syllabus.addModule")}
        </Button>
      </div>

      {modules.length === 0 ? (
        <div className="flex flex-col flex-1 items-center justify-center gap-2 py-12 text-center">
          <span className="flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-50 dark:bg-night-800 text-2xl text-slate-300 dark:text-slate-600">
            <HiClipboardDocumentList />
          </span>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{t("teachingPlan.noModules")}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs">{t("teachingPlan.noModulesHint")}</p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
            <Button className="gap-1.5" onClick={() => openModuleDialog()}>
              <HiPlus className="text-base" />
              {t("syllabus.newModule")}
            </Button>
            <Button variant="outlined" color="emerald" className="gap-1.5" onClick={() => openImport("plan")}>
              <HiArrowUpTray className="text-base" />
              {t("teachingPlan.import.button")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 pb-4">
          {modules.map((module, mi) => (
            <PlanModuleCard
              key={module._id || `m-${mi}`}
              module={module}
              startNo={startNo[module._id || `i-${mi}`] || 1}
              open={visibleOpen.includes(module._id)}
              isFirst={mi === 0}
              isLast={mi === modules.length - 1}
              wide={wide}
              disabled={saving}
              showHomework={showHomework}
              onToggle={() => toggleModule(module._id)}
              onAddLesson={() => setLessonDialog({ lesson: null, moduleId: module._id })}
              onImportLessons={() => openImport("lessons", module._id)}
              onEdit={() => openModuleDialog(module)}
              onDelete={() =>
                setRemoveTarget({ kind: "module", id: module._id, title: module.title })
              }
              onMove={(delta) => moveModule(mi, delta)}
              onEditLesson={(lesson) => setLessonDialog({ lesson, moduleId: module._id })}
              onDeleteLesson={(lesson) =>
                setRemoveTarget({ kind: "lesson", id: lesson._id, title: lesson.title })
              }
              onMoveLesson={(li, delta) => moveLesson(mi, li, delta)}
            />
          ))}
        </div>
      )}

      <PlanImportDialog
        key={importKey}
        open={!!importDialog}
        onClose={() => setImportDialog(null)}
        initialKind={importDialog?.kind || "plan"}
        initialModuleId={importDialog?.moduleId || null}
        modules={modules}
        onSave={(next) => persist(next, "teachingPlan.import.saved")}
      />

      {/* Modul modali */}
      <Dialog
        open={!!moduleDialog}
        onClose={() => setModuleDialog(null)}
        title={moduleDialog?.module ? t("syllabus.editModule") : t("syllabus.newModule")}
        actions={
          <>
            <Button color="black" variant="text" onClick={() => setModuleDialog(null)}>
              {t("common.cancel")}
            </Button>
            <Button loading={saving} onClick={saveModule}>
              {t("common.save")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 w-full">
          <Input
            label={t("syllabus.moduleTitleLabel")}
            placeholder={t("syllabus.moduleTitlePlaceholder")}
            variant="white"
            required
            value={moduleTitle}
            onChange={(e) => setModuleTitle(e.target.value)}
          />
        </div>
      </Dialog>

      {/* Dars modali — Groups/SyllabusDialog qayta ishlatiladi */}
      <SyllabusDialog
        key={lessonDialog?.lesson?._id || lessonDialog?.moduleId || "new-lesson"}
        open={!!lessonDialog}
        onClose={() => setLessonDialog(null)}
        lesson={lessonDialog?.lesson || null}
        moduleId={lessonDialog?.moduleId || ""}
        modules={modules}
        saving={saving}
        canImport={false}
        showHomework={showHomework}
        onSave={saveLesson}
      />

      {/* Nom/fan tahriri */}
      <PlanFormDialog
        key={`form-${formKey}`}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        plan={plan}
        subjects={subjects}
        onSaved={(data) => data && setPlan(data)}
      />

      {/* Modul/dars o'chirish tasdig'i */}
      <Dialog
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title={t("common.delete")}
        actions={
          <>
            <Button color="black" variant="text" onClick={() => setRemoveTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button color="red" loading={saving} onClick={confirmRemove}>
              {t("common.delete")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {removeTarget?.kind === "module"
            ? t("syllabus.deleteModuleConfirm", { title: removeTarget?.title })
            : t("syllabus.deleteLessonConfirm", { title: removeTarget?.title })}
        </p>
      </Dialog>

      {/* Rejani arxivlash tasdig'i ("O'chirish" = Arxivlash) */}
      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={t("teachingPlan.delete")}
        actions={
          <>
            <Button color="black" variant="text" onClick={() => setDeleteOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button color="red" loading={busy} onClick={removePlan}>
              {t("archive.archive")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {t("teachingPlan.deleteConfirm", { title: plan.title })}
        </p>
      </Dialog>
    </div>
  );
}

export default PlanEditor;
