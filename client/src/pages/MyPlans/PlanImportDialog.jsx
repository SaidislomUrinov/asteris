import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiArrowDownTray, HiArrowUpTray, HiExclamationTriangle, HiPlus, HiTrash } from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Button from "../../ui/Button";
import IconButton from "../../ui/IconButton";
import Input from "../../ui/Input";
import Select from "../../ui/Select";
import PlanImportGuide from "./PlanImportGuide";
import { api } from "../../utils/fetching";
import { loadReadXlsx } from "../../utils/lazyLibs";
import { errorMsg } from "../../utils/alert";
import { normalizeSheetRows, parseCsv, tableToModules, tempKey, toServerLessons, validateImport } from "./planExcel";

const LANGS = ["uz", "uzc", "ru", "en"];

/**
 * Dars rejasiga Excel'dan import (docs/API_CONTRACT_teaching_plan_excel_import.md).
 * 1-bosqich: rejim (butun reja / modulga darslar), namuna fayl, fayl tanlash
 * va SVG ko'rsatma. 2-bosqich: o'qilgan daraxtni ko'rib chiqish va tahrirlash.
 * "Saqlash" — muharrirning `persist` (butun daraxt PUT) orqali.
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {"plan"|"lessons"} props.initialKind
 * @param {string|null} [props.initialModuleId] - modul menyusidan ochilganda
 * @param {Array} props.modules - rejaning joriy modullari
 * @param {(nextModules: Array) => Promise<boolean>} props.onSave
 */
export default function PlanImportDialog({ open, onClose, initialKind, initialModuleId = null, modules, onSave }) {
  const { t, i18n } = useTranslation();
  const fileRef = useRef(null);
  const [kind, setKind] = useState(initialKind);
  const [step, setStep] = useState("upload");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState([]);
  const [mode, setMode] = useState("append");
  const [targetId, setTargetId] = useState(initialModuleId || modules[0]?._id || "");
  const [reading, setReading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const target = modules.find((m) => m._id === targetId) || null;
  const lessonsOnly = kind === "lessons";
  const canLessons = modules.length > 0;

  const { errors, invalid } = useMemo(
    () =>
      validateImport(rows, {
        kind,
        existingModules: modules.length,
        existingLessons: target?.lessons?.length || 0,
        replace: mode === "replace",
      }),
    [rows, kind, modules.length, target, mode],
  );
  const lessonCount = rows.reduce((sum, m) => sum + m.lessons.length, 0);

  const downloadTemplate = async () => {
    try {
      setDownloading(true);
      const lang = LANGS.includes(i18n.language) ? i18n.language : "uz";
      const res = await api.get("/teaching-plans/import-template", { params: { kind, lang }, responseType: "blob" });
      if (res.data?.type === "application/json") {
        const parsed = JSON.parse(await res.data.text());
        throw new Error(parsed.msg || "teachingPlan.templateFailed");
      }
      const match = (res.headers["content-disposition"] || "").match(/filename="?([^"]+)"?/);
      const url = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = match ? decodeURIComponent(match[1]) : "template.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      errorMsg(error.message || "teachingPlan.templateFailed");
    } finally {
      setDownloading(false);
    }
  };

  const readFile = async (file) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (name.endsWith(".xls") && !name.endsWith(".xlsx")) return errorMsg("teachingPlan.import.xlsOld");
    try {
      setReading(true);
      const table = name.endsWith(".csv") ? parseCsv(await file.text()) : normalizeSheetRows(await (await loadReadXlsx())(file));
      const parsed = tableToModules(table, kind, t("teachingPlan.import.defaultModule", { n: modules.length + 1 }));
      if (!parsed.length || !parsed.some((m) => m.lessons.length || m.title)) return errorMsg("teachingPlan.import.empty");
      setRows(parsed);
      setFileName(file.name);
      setStep("review");
    } catch {
      errorMsg("teachingPlan.import.readError");
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // Oynadagi daraxtni tahrirlash yordamchilari.
  const updateModule = (mKey, patch) => setRows((prev) => prev.map((m) => (m.key === mKey ? { ...m, ...patch } : m)));
  const updateLesson = (mKey, lKey, patch) =>
    setRows((prev) =>
      prev.map((m) => (m.key === mKey ? { ...m, lessons: m.lessons.map((l) => (l.key === lKey ? { ...l, ...patch } : l)) } : m)),
    );
  const removeLesson = (mKey, lKey) =>
    setRows((prev) => prev.map((m) => (m.key === mKey ? { ...m, lessons: m.lessons.filter((l) => l.key !== lKey) } : m)));
  const addLesson = (mKey) =>
    setRows((prev) =>
      prev.map((m) =>
        m.key === mKey ? { ...m, lessons: [...m.lessons, { key: tempKey(), title: "", description: "", homework: "" }] } : m,
      ),
    );
  const removeModule = (mKey) => setRows((prev) => prev.filter((m) => m.key !== mKey));
  const addModule = () =>
    setRows((prev) => [
      ...prev,
      { key: tempKey(), title: t("teachingPlan.import.defaultModule", { n: modules.length + prev.length + 1 }), lessons: [] },
    ]);

  const save = async () => {
    if (errors.length) return errorMsg(errors[0]);
    let next;
    if (lessonsOnly) {
      if (!target) return errorMsg("syllabus.moduleRequired");
      const added = toServerLessons(rows[0]?.lessons || []);
      next = modules.map((m) => (m._id === target._id ? { ...m, lessons: [...(m.lessons || []), ...added] } : m));
    } else {
      const added = rows.map((m) => ({ title: m.title.trim(), lessons: toServerLessons(m.lessons) }));
      next = mode === "replace" ? added : [...modules, ...added];
    }
    setSaving(true);
    const ok = await onSave(next);
    setSaving(false);
    if (ok) onClose();
  };

  const kindTab = (key, label, disabled = false) => (
    <button
      key={key}
      type="button"
      disabled={disabled || step === "review"}
      onClick={() => setKind(key)}
      className={`flex-1 h-9 px-3 rounded-lg text-[13px] font-semibold cursor-pointer whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        kind === key
          ? "bg-white dark:bg-night-900 text-slate-900 dark:text-slate-100 shadow-sm dark:shadow-none"
          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
      }`}
    >
      {label}
    </button>
  );

  const fieldLabel = (text) => (
    <span className="sm:hidden text-[11px] font-medium text-slate-400 dark:text-slate-500">{text}</span>
  );

  const lessonRow = (m, l, index) => {
    const bad = invalid.has(l.key);
    return (
      <div
        key={l.key}
        className="grid grid-cols-[24px_minmax(0,1fr)_36px] sm:grid-cols-[24px_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_36px] gap-x-2 gap-y-1.5 items-start p-2 rounded-lg bg-slate-50 dark:bg-night-800/60"
      >
        <span className="pt-2.5 text-xs font-semibold tabular-nums text-slate-400 dark:text-slate-500">{index + 1}</span>
        <div className="flex flex-col gap-1 min-w-0">
          {fieldLabel(t("teachingPlan.import.colTitle"))}
          <Input
            value={l.title}
            onChange={(e) => updateLesson(m.key, l.key, { title: e.target.value })}
            placeholder={t("teachingPlan.import.colTitle")}
            error={bad}
          />
        </div>
        <div className="col-start-2 sm:col-start-auto flex flex-col gap-1 min-w-0">
          {fieldLabel(t("teachingPlan.import.colDescription"))}
          <Input
            value={l.description}
            onChange={(e) => updateLesson(m.key, l.key, { description: e.target.value })}
            placeholder={t("teachingPlan.import.colDescription")}
          />
        </div>
        <div className="col-start-2 sm:col-start-auto flex flex-col gap-1 min-w-0">
          {fieldLabel(t("teachingPlan.import.colHomework"))}
          <Input
            value={l.homework}
            onChange={(e) => updateLesson(m.key, l.key, { homework: e.target.value })}
            placeholder={t("teachingPlan.import.colHomework")}
          />
        </div>
        <div className="row-start-1 col-start-3 sm:row-start-auto sm:col-start-auto">
          <IconButton variant="ghost" color="red" title={t("common.delete")} onClick={() => removeLesson(m.key, l.key)}>
            <HiTrash />
          </IconButton>
        </div>
      </div>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      widthClass="md:w-215"
      title={t("teachingPlan.import.title")}
      actions={
        step === "review" ? (
          <>
            <Button color="black" variant="text" onClick={() => setStep("upload")}>
              {t("teachingPlan.import.otherFile")}
            </Button>
            <Button color={mode === "replace" && !lessonsOnly ? "red" : "blue"} loading={saving} disabled={errors.length > 0} onClick={save}>
              {mode === "replace" && !lessonsOnly ? t("teachingPlan.import.replaceSave") : t("common.save")}
            </Button>
          </>
        ) : (
          <Button color="black" variant="text" onClick={onClose}>
            {t("common.cancel")}
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-night-800">
          {kindTab("plan", t("teachingPlan.import.modePlan"))}
          {kindTab("lessons", t("teachingPlan.import.modeLessons"), !canLessons)}
        </div>

        {step === "upload" ? (
          <>
            <PlanImportGuide kind={kind} />
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outlined" color="emerald" className="gap-1.5" loading={downloading} onClick={downloadTemplate}>
                <HiArrowDownTray className="text-base shrink-0" />
                {t("teachingPlan.import.template")}
              </Button>
            </div>
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                readFile(e.dataTransfer.files?.[0]);
              }}
              className={`flex flex-col items-center justify-center gap-1.5 p-5 rounded-2xl border-2 border-dashed cursor-pointer text-center transition-colors ${
                dragOver
                  ? "border-blue-400 bg-blue-50 dark:bg-blue-500/10"
                  : "border-slate-300 dark:border-night-700 bg-slate-50/50 dark:bg-night-800/30 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:border-blue-500/50 dark:hover:bg-blue-500/10"
              }`}
            >
              <span className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-50 dark:bg-blue-500/15"><HiArrowUpTray className="text-xl text-blue-500" /></span>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {reading ? t("common.loading") : t("teachingPlan.import.pickFile")}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">{t("teachingPlan.import.dropHint")}</span>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => readFile(e.target.files?.[0])}
              />
            </label>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
              <span className="font-semibold truncate max-w-full">{fileName}</span>
              <span className="text-slate-400 dark:text-slate-500">
                {lessonsOnly
                  ? t("teachingPlan.import.summaryLessons", { lessons: lessonCount })
                  : t("teachingPlan.import.summary", { modules: rows.length, lessons: lessonCount })}
              </span>
            </div>

            {lessonsOnly ? (
              <Select
                label={t("teachingPlan.import.targetModule")}
                value={targetId}
                onChange={setTargetId}
                options={modules.map((m) => ({ value: m._id, label: m.title }))}
              />
            ) : (
              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-night-800 self-start">
                {["append", "replace"].map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setMode(key)}
                    className={`h-8 px-3 rounded-lg text-[13px] font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                      mode === key
                        ? key === "replace"
                          ? "bg-white dark:bg-night-900 text-red-600 dark:text-red-400 shadow-sm dark:shadow-none"
                          : "bg-white dark:bg-night-900 text-slate-900 dark:text-slate-100 shadow-sm dark:shadow-none"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    {t(`teachingPlan.import.${key}`)}
                  </button>
                ))}
              </div>
            )}
            {!lessonsOnly && mode === "replace" && modules.length > 0 && (
              <div className="flex items-start gap-2 px-3 py-2 rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-xs font-medium text-red-600 dark:text-red-400">
                <HiExclamationTriangle className="shrink-0 text-base" />
                <span>{t("teachingPlan.import.replaceConfirm", { count: modules.length })}</span>
              </div>
            )}

            {errors.length > 0 && (
              <div className="flex flex-col gap-1 px-3 py-2 rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-xs font-medium text-red-600 dark:text-red-400">
                {errors.map((e) => (
                  <span key={e}>{t(e)}</span>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-3 max-h-[52vh] overflow-y-auto pr-1">
              {rows.map((m, mi) => (
                <div key={m.key} className="flex flex-col gap-2 p-3 rounded-xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900">
                  {!lessonsOnly && (
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center justify-center shrink-0 tabular-nums">{mi + 1}</span>
                      <div className="flex-1 min-w-0">
                        <Input
                          value={m.title}
                          onChange={(e) => updateModule(m.key, { title: e.target.value })}
                          placeholder={t("teachingPlan.import.colModule")}
                          error={invalid.has(m.key)}
                        />
                      </div>
                      <IconButton variant="ghost" color="red" title={t("common.delete")} onClick={() => removeModule(m.key)}>
                        <HiTrash />
                      </IconButton>
                    </div>
                  )}
                  {m.lessons.map((l, li) => lessonRow(m, l, li))}
                  <button
                    type="button"
                    onClick={() => addLesson(m.key)}
                    className="self-start flex items-center gap-1 h-8 px-2 rounded-lg text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/15 cursor-pointer transition-colors"
                  >
                    <HiPlus className="shrink-0" />
                    {t("teachingPlan.import.addLesson")}
                  </button>
                </div>
              ))}
              {!lessonsOnly && (
                <button
                  type="button"
                  onClick={addModule}
                  className="self-start flex items-center gap-1 h-8 px-2 rounded-lg text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/15 cursor-pointer transition-colors"
                >
                  <HiPlus className="shrink-0" />
                  {t("teachingPlan.import.addModule")}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
