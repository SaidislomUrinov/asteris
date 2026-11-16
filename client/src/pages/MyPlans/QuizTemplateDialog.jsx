import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Dialog from "../../ui/Dialog";
import Button from "../../ui/Button";
import Input from "../../ui/Input";
import Select from "../../ui/Select";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import { createQuizTemplate, updateQuizTemplate, importQuizFile, importQuizJson } from "../../api/quiz";
import QuestionsEditor from "../Groups/QuestionsEditor";
import { emptyQuestion, isBlankQuestion, newKey, OPTION_IDS } from "../Groups/quizQuestions";

const TITLE_MAX = 120;

// Excel/JSON import endpoint guruh doirasida (`/quiz/:groupId/import`) —
// lekin faqat faylni PARSE qiladi, hech narsa saqlamaydi (quiz.service.js
// `assertGroup` → normalizeQuestions). Shablonda haqiqiy guruh konteksti
// yo'q, shu sabab o'qituvchining o'ziga tegishli ISTALGAN guruhi "proxy"
// sifatida ishlatiladi — faqat ruxsat tekshiruvi (`assertGroup`) o'tishi
// uchun, natija shu guruhga bog'lanmaydi.
const fetchProxyGroupId = async () => {
  try {
    const res = await api.get("/groups", { params: { page: 1 } });
    const { ok, data } = res.data;
    return ok && data?.[0]?._id ? data[0]._id : null;
  } catch {
    return null;
  }
};

/**
 * Test shabloni yaratish/tahrirlash modali (API_CONTRACT_quiz_templates.md).
 * `SendQuizDialog.jsx`ga o'xshash, lekin fan tanlovi bor va startAt/duration
 * YO'Q (ular faqat yuborish paytida so'raladi, `SendTemplateDialog.jsx`).
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {Object|null} props.template - tahrirlanayotgan shablon (null = yangi)
 * @param {Array<{_id, name}>} props.subjects - o'qituvchining fanlari
 * @param {string} [props.defaultSubject]
 * @param {(template) => void} props.onSaved
 */
function QuizTemplateDialog({ open, onClose, template = null, subjects = [], defaultSubject = "", onSaved }) {
  const { t } = useTranslation();
  const isEdit = !!template?._id;
  const [title, setTitle] = useState(() => template?.title || "");
  const [subject, setSubject] = useState(
    () => template?.subject?._id || defaultSubject || (subjects.length === 1 ? subjects[0]._id : ""),
  );
  const [questions, setQuestions] = useState(() =>
    template?.questions?.length
      ? template.questions.map((q) => ({
          key: newKey(),
          text: q.text,
          options: q.options.map((o) => ({ ...o })),
          correctOptionId: q.correctOptionId,
        }))
      : [emptyQuestion()],
  );
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const [activeTab, setActiveTab] = useState("manual");
  const [jsonDraft, setJsonDraft] = useState("");
  const [importing, setImporting] = useState(false);
  const proxyGroupRef = useRef(null);
  const [proxyReady, setProxyReady] = useState(null); // null = yuklanmoqda, false = guruh yo'q

  useEffect(() => {
    let cancelled = false;
    fetchProxyGroupId().then((id) => {
      if (cancelled) return;
      proxyGroupRef.current = id;
      setProxyReady(!!id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const options = subjects.map((s) => ({ value: s._id, label: s.name }));
  if (template?.subject?._id && !options.some((o) => o.value === template.subject._id)) {
    options.unshift({ value: template.subject._id, label: template.subject.name });
  }

  const subjectError = touched && !subject;

  const updateQuestion = (key, patch) =>
    setQuestions((prev) => prev.map((q) => (q.key === key ? { ...q, ...patch } : q)));
  const addQuestion = () => setQuestions((prev) => [...prev, emptyQuestion()]);
  const removeQuestion = (key) =>
    setQuestions((prev) => (prev.length > 1 ? prev.filter((q) => q.key !== key) : prev));
  const addOption = (key) =>
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.key !== key || q.options.length >= 6) return q;
        return { ...q, options: [...q.options, { id: OPTION_IDS[q.options.length], text: "" }] };
      }),
    );
  const removeOption = (key, optionId) =>
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.key !== key || q.options.length <= 2) return q;
        const kept = q.options.filter((o) => o.id !== optionId);
        const correctIndex = kept.findIndex((o) => o.id === q.correctOptionId);
        return {
          ...q,
          options: kept.map((o, i) => ({ ...o, id: OPTION_IDS[i] })),
          correctOptionId: OPTION_IDS[Math.max(0, correctIndex)],
        };
      }),
    );

  const applyImported = (list) => {
    if (!Array.isArray(list) || !list.length) {
      errorMsg("quiz.invalidQuestions");
      return;
    }
    const imported = list.map((q) => ({
      key: newKey(),
      text: q.text || "",
      options: (q.options || []).slice(0, 6),
      correctOptionId: q.correctOptionId || q.options?.[0]?.id || "a",
    }));
    setQuestions((prev) => [...prev.filter((q) => !isBlankQuestion(q)), ...imported]);
    setJsonDraft("");
    setActiveTab("manual");
    successMsg("quiz.send.imported");
  };

  const importFromFile = async (file) => {
    if (!proxyGroupRef.current) return errorMsg("quiz.template.noGroups");
    try {
      setImporting(true);
      const res = await importQuizFile(proxyGroupRef.current, file);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      applyImported(data?.questions);
    } catch (err) {
      errorMsg(err.message);
    } finally {
      setImporting(false);
    }
  };

  const importFromJson = async () => {
    if (!proxyGroupRef.current) return errorMsg("quiz.template.noGroups");
    try {
      setImporting(true);
      let parsed;
      try {
        const raw = jsonDraft.trim().replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, "");
        parsed = JSON.parse(raw);
      } catch {
        throw new Error("quiz.invalidQuestions");
      }
      const list = Array.isArray(parsed) ? parsed : parsed.questions;
      const res = await importQuizJson(proxyGroupRef.current, list);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      applyImported(data?.questions);
    } catch (err) {
      errorMsg(err.message);
    } finally {
      setImporting(false);
    }
  };

  const valid =
    title.trim() &&
    subject &&
    questions.length > 0 &&
    questions.every(
      (q) =>
        q.text.trim() &&
        q.options.length >= 2 &&
        q.options.every((o) => o.text.trim()) &&
        q.options.some((o) => o.id === q.correctOptionId),
    );

  const submit = async () => {
    setTouched(true);
    if (!title.trim()) return errorMsg("teachingPlan.titleRequired");
    if (!subject) return errorMsg("teachingPlan.subjectRequired");
    if (!valid || saving) return;
    try {
      setSaving(true);
      const body = {
        title: title.trim(),
        subject,
        questions: questions.map(({ text, options, correctOptionId }) => ({
          text: text.trim(),
          options: options.map((o) => ({ id: o.id, text: o.text.trim() })),
          correctOptionId,
        })),
      };
      const res = isEdit ? await updateQuizTemplate(template._id, body) : await createQuizTemplate(body);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg || (isEdit ? "quiz.template.saved" : "quiz.template.created"));
      onSaved?.(data);
      onClose();
    } catch (err) {
      errorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => !saving && onClose()}
      title={t(isEdit ? "quiz.template.edit" : "quiz.template.create")}
      widthClass="md:w-175"
      actions={
        <>
          <Button color="black" variant="text" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button loading={saving} disabled={!valid} onClick={submit}>
            {isEdit ? t("common.save") : t("quiz.template.create")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label={t("quiz.send.titleLabel")}
            placeholder={t("quiz.send.titlePlaceholder")}
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
          />
          <Select
            label={t("teachingPlan.subjectLabel")}
            placeholder={t("teachingPlan.subjectPlaceholder")}
            value={subject}
            onChange={setSubject}
            options={options}
          />
        </div>
        {subjectError && <p className="text-xs text-red-500">{t("teachingPlan.subjectRequired")}</p>}
        {subjects.length === 0 && (
          <p className="text-xs text-slate-400 dark:text-slate-500">{t("teachingPlan.noSubjects")}</p>
        )}

        <QuestionsEditor
          t={t}
          questions={questions}
          onUpdateQuestion={updateQuestion}
          onAddQuestion={addQuestion}
          onRemoveQuestion={removeQuestion}
          onAddOption={addOption}
          onRemoveOption={removeOption}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          jsonDraft={jsonDraft}
          setJsonDraft={setJsonDraft}
          importing={importing}
          onImportFile={importFromFile}
          onImportJson={importFromJson}
          disableImportTabs={proxyReady === false}
        />
        {proxyReady === false && (
          <p className="text-xs text-slate-400 dark:text-slate-500">{t("quiz.template.noGroups")}</p>
        )}
      </div>
    </Dialog>
  );
}

export default QuizTemplateDialog;
