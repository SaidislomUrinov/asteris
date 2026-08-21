import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiArrowDownTray,
  HiChevronDown,
  HiClipboardDocumentList,
  HiEllipsisVertical,
  HiExclamationTriangle,
  HiPencilSquare,
  HiPlus,
  HiTrash,
} from "react-icons/hi2";
import Button from "../../ui/Button";
import IconButton from "../../ui/IconButton";
import Input from "../../ui/Input";
import Dialog from "../../ui/Dialog";
import Loading from "../../ui/Loading";
import ProgressBar from "../../ui/ProgressBar";
import SyllabusDialog from "./SyllabusDialog";
import ImportSyllabusDialog from "./ImportSyllabusDialog";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";

/**
 * "Reja" tabi — guruhning kurs dasturi (Syllabus).
 * Eski `LessonPlanTab` o'rnini bosadi (API_CONTRACT_syllabus.md §6).
 *
 * Progress DAVOMATDAN avtomatik hisoblanadi (backend), bu yerda faqat
 * ko'rsatiladi: o'tilgan darslar so'ngan, joriy dars ajratilgan.
 * Har amal (modul/dars qo'shish, tahrirlash, o'chirish) butun daraxtni
 * `PUT /syllabus/:groupId` bilan saqlaydi (full replace).
 *
 * @param {Object} props
 * @param {string} props.groupId
 * @param {boolean} props.canWrite - `lesson:update`
 * @param {boolean} props.canImport - `lesson:create`
 */
function SyllabusTab({ groupId, canWrite = false, canImport = false }) {
  const { t } = useTranslation();

  const [modules, setModules] = useState([]);
  const [progress, setProgress] = useState(null);
  const [lessonOffset, setLessonOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [openIds, setOpenIds] = useState(null); // yoyilgan modullar (null = default)

  const [moduleDialog, setModuleDialog] = useState(null); // { module | null }
  const [moduleTitle, setModuleTitle] = useState("");
  const [lessonDialog, setLessonDialog] = useState(null); // { lesson, moduleId } | null
  const [removeTarget, setRemoveTarget] = useState(null); // { kind, ... }
  const [importOpen, setImportOpen] = useState(false);
  const [offsetOpen, setOffsetOpen] = useState(false);
  const [offsetValue, setOffsetValue] = useState("0");
  const [menuOpen, setMenuOpen] = useState(false);

  const applyData = useCallback((data) => {
    setModules(data?.modules || []);
    setProgress(data?.progress || null);
    setLessonOffset(data?.lessonOffset || 0);
  }, []);

  const fetchSyllabus = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");
      const res = await api.get(`/syllabus/${groupId}`);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      applyData(data);
    } catch (error) {
      setLoadError(error.message || "syllabus.loadError");
    } finally {
      setLoading(false);
    }
  }, [groupId, applyData]);

  useEffect(() => {
    // setTimeout — `react-hooks/set-state-in-effect` bo'yicha mavjud naqsh:
    // so'rov effekt tanasidan tashqariga chiqariladi.
    const id = setTimeout(fetchSyllabus, 0);
    return () => clearTimeout(id);
  }, [fetchSyllabus]);

  // Boshqa qurilma/hodim o'zgartirsa ro'yxat jonli yangilanadi.
  useSocketEvent("syllabus:changed", (p) => {
    if (p?.groupId === groupId) fetchSyllabus();
  });

  // Darslarni ketma-ket raqamlash (flatten) — "7-dars" ko'rsatish uchun.
  const numbering = useMemo(() => {
    const map = {}; // lessonId -> tartib raqami (1 dan)
    const startNo = {}; // moduleId -> shu modul birinchi darsining raqami
    let no = 0;
    for (const m of modules) {
      startNo[m._id] = no + 1;
      for (const l of m.lessons || []) map[l._id] = ++no;
    }
    return { map, startNo, total: no };
  }, [modules]);

  const doneCount = progress?.doneCount || 0;
  const nextNo = progress?.nextNo || null;
  const totalLessons = progress?.totalLessons ?? numbering.total;
  const moduleCount = progress?.moduleCount ?? modules.length;
  const currentModuleIndex = progress?.currentModuleIndex ?? 0;
  const finished = !!progress?.finished;

  // Joriy modul avtomatik ochiladi (foydalanuvchi qo'lda o'zgartirmaguncha) —
  // effekt orqali emas, hisoblanadigan default orqali.
  const defaultOpen = useMemo(() => {
    const current = modules[currentModuleIndex] || modules[0];
    return current ? [current._id] : [];
  }, [modules, currentModuleIndex]);
  const visibleOpen = openIds ?? defaultOpen;

  const toggleModule = (id) =>
    setOpenIds((prev) => {
      const base = prev ?? defaultOpen;
      return base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    });

  // Butun daraxtni saqlash — barcha CRUD amali shu orqali o'tadi.
  const persist = async (nextModules, okMsg) => {
    try {
      setSaving(true);
      const body = {
        modules: nextModules.map((m) => ({
          _id: m._id,
          title: m.title,
          lessons: (m.lessons || []).map((l) => ({
            _id: l._id,
            title: l.title,
            description: l.description || "",
            homework: l.homework || "",
          })),
        })),
      };
      const res = await api.put(`/syllabus/${groupId}`, body);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      applyData(data);
      successMsg(okMsg || msg || "syllabus.saved");
      return true;
    } catch (error) {
      errorMsg(error.message);
      return false;
    } finally {
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
      // Modul o'zgargan bo'lsa — eskisidan olib, yangisiga qo'shamiz.
      next = modules.map((m) => ({
        ...m,
        lessons: (m.lessons || []).filter((l) => l._id !== editing._id),
      }));
      next = next.map((m) =>
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

  const saveOffset = async () => {
    try {
      setSaving(true);
      const value = Math.max(0, Number(offsetValue) || 0);
      const res = await api.patch(`/syllabus/${groupId}/offset`, { lessonOffset: value });
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      applyData(data);
      successMsg(msg || "syllabus.offsetSaved");
      setOffsetOpen(false);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loading />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center gap-2 text-center">
        <span className="flex items-center justify-center w-14 h-14 rounded-2xl bg-red-50 text-2xl text-red-400">
          <HiExclamationTriangle />
        </span>
        <p className="text-sm font-medium text-slate-600">{t("syllabus.loadError")}</p>
        <p className="text-xs text-slate-400">{t(loadError)}</p>
        <Button variant="outlined" color="black" onClick={fetchSyllabus}>
          {t("syllabus.retry")}
        </Button>
      </div>
    );
  }

  const hasSyllabus = modules.length > 0;

  return (
    <div className="flex flex-col flex-1 gap-3">
      {/* Sarlavha + amallar */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {t("syllabus.title")}
        </p>
        <div className="flex items-center gap-2">
          {canImport && (
            <Button variant="outlined" color="black" className="gap-1.5" onClick={() => setImportOpen(true)}>
              <HiArrowDownTray className="text-base" />
              <span className="hidden sm:inline">{t("syllabus.import")}</span>
              <span className="sm:hidden">{t("syllabus.importShort")}</span>
            </Button>
          )}
          {canWrite && (
            <Button variant="outlined" className="gap-1.5" onClick={() => openModuleDialog()}>
              <HiPlus className="text-base" />
              {t("syllabus.addModule")}
            </Button>
          )}
          {canWrite && (
            <div className="relative">
              <IconButton
                variant="ghost"
                color="black"
                title={t("syllabus.offset")}
                onClick={() => setMenuOpen((v) => !v)}
              >
                <HiEllipsisVertical />
              </IconButton>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full z-20 mt-1 min-w-52 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm text-slate-700 rounded-lg hover:bg-slate-50 cursor-pointer"
                      onClick={() => {
                        setMenuOpen(false);
                        setOffsetValue(String(lessonOffset));
                        setOffsetOpen(true);
                      }}
                    >
                      {t("syllabus.offset")}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Progress — hali bitta ham mavzu kiritilmagan bo'lsa ko'rsatilmaydi
          (aks holda "Modul 1/1 · 0-dars · 0/0" kabi ma'nosiz qator chiqardi). */}
      {hasSyllabus && totalLessons > 0 && (
        <div className="flex flex-col gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50/60">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-800">
              {finished
                ? t("syllabus.finished")
                : t("syllabus.progress", {
                    module: Math.min(currentModuleIndex + 1, moduleCount),
                    moduleCount,
                    lesson: nextNo || totalLessons,
                  })}
            </span>
            <span className="text-xs font-jet tabular-nums text-slate-500">
              {Math.min(doneCount, totalLessons)}/{totalLessons}
            </span>
          </div>
          <ProgressBar
            value={Math.min(doneCount, totalLessons)}
            max={totalLessons}
            color={finished ? "emerald" : "blue"}
          />
        </div>
      )}

      {/* Modullar akkordeoni */}
      {!hasSyllabus ? (
        <div className="flex flex-col flex-1 items-center justify-center gap-2 text-center">
          <span className="flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-50 text-2xl text-slate-300">
            <HiClipboardDocumentList />
          </span>
          <p className="text-sm font-medium text-slate-600">{t("syllabus.empty")}</p>
          <p className="text-xs text-slate-400 max-w-xs">{t("syllabus.emptyHint")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {modules.map((module, mi) => {
            const lessons = module.lessons || [];
            const open = visibleOpen.includes(module._id);
            const first = numbering.startNo[module._id] || 1;
            const doneInModule = Math.max(0, Math.min(lessons.length, doneCount - first + 1));
            const isCurrentModule = !finished && mi === currentModuleIndex;

            return (
              <div
                key={module._id || `m-${mi}`}
                className={`flex flex-col rounded-xl border bg-white overflow-hidden ${
                  isCurrentModule ? "border-blue-300 ring-1 ring-blue-100" : "border-slate-200"
                }`}
              >
                <div className="flex items-center gap-2 p-3">
                  <button
                    type="button"
                    onClick={() => toggleModule(module._id)}
                    className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                  >
                    <HiChevronDown
                      className={`shrink-0 text-slate-400 transition-transform duration-200 ${
                        open ? "" : "-rotate-90"
                      }`}
                    />
                    <span className="text-sm font-semibold text-slate-800 truncate">
                      {module.title}
                    </span>
                    <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-slate-100 text-[11px] text-slate-500 tabular-nums">
                      {t("syllabus.moduleLessons", { count: lessons.length })}
                    </span>
                    {lessons.length > 0 && (
                      <span className="hidden sm:inline shrink-0 text-[11px] text-slate-400 tabular-nums">
                        {t("syllabus.moduleProgress", {
                          done: doneInModule,
                          total: lessons.length,
                        })}
                      </span>
                    )}
                  </button>

                  {canWrite && (
                    <div className="flex items-center gap-1 shrink-0">
                      <IconButton
                        variant="ghost"
                        color="black"
                        title={t("syllabus.addLesson")}
                        onClick={() => setLessonDialog({ lesson: null, moduleId: module._id })}
                      >
                        <HiPlus />
                      </IconButton>
                      <IconButton
                        variant="ghost"
                        color="black"
                        title={t("common.edit")}
                        onClick={() => openModuleDialog(module)}
                      >
                        <HiPencilSquare />
                      </IconButton>
                      <IconButton
                        variant="ghost"
                        color="red"
                        title={t("common.delete")}
                        onClick={() =>
                          setRemoveTarget({ kind: "module", id: module._id, title: module.title })
                        }
                      >
                        <HiTrash />
                      </IconButton>
                    </div>
                  )}
                </div>

                {open && (
                  <div className="flex flex-col border-t border-slate-100">
                    {lessons.length === 0 ? (
                      <p className="px-4 py-3 text-xs text-slate-400">{t("syllabus.noLessons")}</p>
                    ) : (
                      lessons.map((lesson) => {
                        const no = numbering.map[lesson._id];
                        const isDone = no <= doneCount;
                        const isCurrent = nextNo && no === nextNo;

                        return (
                          <div
                            key={lesson._id}
                            className={`flex items-start gap-3 px-3 py-2.5 border-b border-slate-50 last:border-b-0 ${
                              isCurrent ? "bg-blue-50/60" : ""
                            }`}
                          >
                            <span
                              className={`flex items-center justify-center w-7 h-7 shrink-0 rounded-lg text-[13px] font-semibold tabular-nums ${
                                isCurrent
                                  ? "bg-blue-500 text-white"
                                  : isDone
                                    ? "bg-slate-100 text-slate-300"
                                    : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {no}
                            </span>

                            <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`text-sm font-semibold ${
                                    isDone
                                      ? "text-slate-400 line-through decoration-slate-300"
                                      : "text-slate-800"
                                  }`}
                                >
                                  {lesson.title}
                                </span>
                                {isCurrent && (
                                  <span className="px-1.5 py-0.5 rounded-md bg-blue-100 text-[10px] font-semibold uppercase text-blue-600">
                                    {t("syllabus.current")}
                                  </span>
                                )}
                              </div>
                              {lesson.description && (
                                <p
                                  className={`text-xs whitespace-pre-line ${
                                    isDone ? "text-slate-300" : "text-slate-500"
                                  }`}
                                >
                                  {lesson.description}
                                </p>
                              )}
                              {lesson.homework && (
                                <p className={`text-xs ${isDone ? "text-slate-300" : "text-blue-600"}`}>
                                  <span className="text-slate-400">
                                    {t("syllabus.homeworkLabel")}:{" "}
                                  </span>
                                  {lesson.homework}
                                </p>
                              )}
                            </div>

                            {canWrite && (
                              <div className="flex items-center gap-1 shrink-0">
                                <IconButton
                                  variant="ghost"
                                  color="black"
                                  title={t("common.edit")}
                                  onClick={() => setLessonDialog({ lesson, moduleId: module._id })}
                                >
                                  <HiPencilSquare />
                                </IconButton>
                                <IconButton
                                  variant="ghost"
                                  color="red"
                                  title={t("common.delete")}
                                  onClick={() =>
                                    setRemoveTarget({
                                      kind: "lesson",
                                      id: lesson._id,
                                      title: lesson.title,
                                    })
                                  }
                                >
                                  <HiTrash />
                                </IconButton>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

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
        <Input
          label={t("syllabus.moduleTitleLabel")}
          placeholder={t("syllabus.moduleTitlePlaceholder")}
          variant="white"
          required
          value={moduleTitle}
          onChange={(e) => setModuleTitle(e.target.value)}
        />
      </Dialog>

      {/* Mavzu modali */}
      <SyllabusDialog
        key={lessonDialog?.lesson?._id || lessonDialog?.moduleId || "new-lesson"}
        open={!!lessonDialog}
        onClose={() => setLessonDialog(null)}
        lesson={lessonDialog?.lesson || null}
        moduleId={lessonDialog?.moduleId || ""}
        modules={modules}
        saving={saving}
        canImport={canImport}
        onImport={() => {
          setLessonDialog(null);
          setImportOpen(true);
        }}
        onSave={saveLesson}
      />

      {/* Import modali */}
      <ImportSyllabusDialog
        key={importOpen ? "import-open" : "import-closed"}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        groupId={groupId}
        hasSyllabus={hasSyllabus}
        onImported={applyData}
      />

      {/* Boshlanish nuqtasi (lessonOffset) */}
      <Dialog
        open={offsetOpen}
        onClose={() => setOffsetOpen(false)}
        title={t("syllabus.offset")}
        actions={
          <>
            <Button color="black" variant="text" onClick={() => setOffsetOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button loading={saving} onClick={saveOffset}>
              {t("common.save")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2 w-full">
          <Input
            type="number"
            min="0"
            label={t("syllabus.offsetLabel")}
            variant="white"
            value={offsetValue}
            onChange={(e) => setOffsetValue(e.target.value)}
          />
          <p className="text-xs text-slate-400">{t("syllabus.offsetHint")}</p>
        </div>
      </Dialog>

      {/* O'chirish tasdig'i */}
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
        <p className="text-sm text-slate-600">
          {removeTarget?.kind === "module"
            ? t("syllabus.deleteModuleConfirm", { title: removeTarget?.title })
            : t("syllabus.deleteLessonConfirm", { title: removeTarget?.title })}
        </p>
      </Dialog>
    </div>
  );
}

export default SyllabusTab;
