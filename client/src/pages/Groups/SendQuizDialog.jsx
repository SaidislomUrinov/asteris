import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiDocumentDuplicate } from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Button from "../../ui/Button";
import Input from "../../ui/Input";
import Select from "../../ui/Select";
import TimeInput from "../../ui/TimeInput";
import {
  sendQuiz,
  updateQuiz,
  importQuizFile,
  importQuizJson,
  listQuizTemplates,
  getQuizTemplate,
} from "../../api/quiz";
import { errorMsg, successMsg } from "../../utils/alert";
import QuestionsEditor from "./QuestionsEditor";
import { emptyQuestion, isBlankQuestion, newKey, OPTION_IDS } from "./quizQuestions";

const DEFAULT_DURATION = 10;

const pad = (n) => String(n).padStart(2, "0");

// Standart boshlanish — hozirdan 5 daqiqa keyin: o'quvchilar xabarni ko'rib,
// ilovani ochishga ulguradi.
const defaultStart = () => {
  const d = new Date(Date.now() + 5 * 60 * 1000);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const hhmmOf = (unixSec) => {
  const d = new Date(unixSec * 1000);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * "Test yuborish" / "Testni tahrirlash" modali. Test sozlamalari (nom,
 * boshlanish vaqti, umumiy davomiylik) + savollar (qo'lda yoki Excel/JSON
 * importi bilan).
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} props.groupId
 * @param {string} [props.subjectId] - guruh fani — shu fanga tegishli test shablonlarini
 *   ("Dars rejalarim" → Testlar tabida yaratilgan) tanlab, savollarini shu yerga yuklash uchun
 * @param {Object} [props.quiz] - berilsa tahrirlash rejimi (faqat rejalashtirilgan test)
 * @param {(quiz: Object) => void} [props.onSent]
 */
function SendQuizDialog({ open, onClose, groupId, subjectId, quiz = null, onSent }) {
  const { t } = useTranslation();
  const editing = !!quiz;
  const [title, setTitle] = useState(quiz?.title || "");
  const [startAt, setStartAt] = useState(() => (quiz ? hhmmOf(quiz.startAt) : defaultStart()));
  const [durationMin, setDurationMin] = useState(() =>
    quiz ? String(Math.round(quiz.totalTimeSec / 60)) : String(DEFAULT_DURATION),
  );
  const [questions, setQuestions] = useState(() =>
    quiz?.questions?.length
      ? quiz.questions.map((q) => ({
          key: newKey(),
          text: q.text,
          options: q.options.map((o) => ({ ...o })),
          correctOptionId: q.correctOptionId,
        }))
      : [emptyQuestion()],
  );
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("manual"); // manual | excel | json
  const [jsonDraft, setJsonDraft] = useState("");
  const [importing, setImporting] = useState(false);
  const [templates, setTemplates] = useState(null);
  const [templateId, setTemplateId] = useState("");
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  // Shablonlar — faqat yangi test yuborishda, shu guruhning faniga tegishli
  // ("Dars rejalarim" → Testlar tabida yaratilganlar).
  useEffect(() => {
    const id = setTimeout(() => {
      if (!open || editing || !subjectId) {
        setTemplates(null);
        return;
      }
      listQuizTemplates(subjectId)
        .then((res) => setTemplates(res.data?.data || []))
        .catch(() => setTemplates([]));
    }, 0);
    return () => clearTimeout(id);
  }, [open, editing, subjectId]);

  const applyTemplate = async (id) => {
    setTemplateId(id);
    if (!id) return;
    try {
      setLoadingTemplate(true);
      const res = await getQuizTemplate(id);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setTitle(data.title || "");
      setQuestions(
        data.questions.map((q) => ({
          key: newKey(),
          text: q.text,
          options: q.options.map((o) => ({ ...o })),
          correctOptionId: q.correctOptionId,
        })),
      );
      if (data.defaultDurationMin) setDurationMin(String(data.defaultDurationMin));
    } catch (err) {
      errorMsg(err.message);
    } finally {
      setLoadingTemplate(false);
    }
  };

  const close = () => {
    if (saving) return;
    if (!editing) {
      setTitle("");
      setStartAt(defaultStart());
      setDurationMin(String(DEFAULT_DURATION));
      setQuestions([emptyQuestion()]);
    }
    setJsonDraft("");
    setActiveTab("manual");
    setTemplateId("");
    onClose();
  };

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
  // Variant o'chirilganda harflar qayta tartiblanadi (A, B, C... uzilmasin).
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

  // Import — bo'sh turgan boshlang'ich savol o'rnini egallaydi, aks holda
  // mavjud savollar oxiriga qo'shiladi.
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
    try {
      setImporting(true);
      const res = await importQuizFile(groupId, file);
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
    try {
      setImporting(true);
      let parsed;
      try {
        // AI javobi ko'pincha ```json ... ``` ichida keladi — o'ramni olib tashlaymiz.
        const raw = jsonDraft.trim().replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, "");
        parsed = JSON.parse(raw);
      } catch {
        throw new Error("quiz.invalidQuestions");
      }
      const list = Array.isArray(parsed) ? parsed : parsed.questions;
      const res = await importQuizJson(groupId, list);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      applyImported(data?.questions);
    } catch (err) {
      errorMsg(err.message);
    } finally {
      setImporting(false);
    }
  };

  const duration = Number(durationMin);
  const valid =
    /^\d{2}:\d{2}$/.test(startAt) &&
    Number.isFinite(duration) &&
    duration >= 1 &&
    duration <= 180 &&
    questions.length > 0 &&
    questions.every(
      (q) =>
        q.text.trim() &&
        q.options.length >= 2 &&
        q.options.every((o) => o.text.trim()) &&
        q.options.some((o) => o.id === q.correctOptionId),
    );

  const save = async () => {
    if (saving || !valid) return;
    try {
      setSaving(true);
      const body = {
        title: title.trim(),
        startAt,
        durationMin: duration,
        questions: questions.map(({ text, options, correctOptionId }) => ({
          text: text.trim(),
          options: options.map((o) => ({ id: o.id, text: o.text.trim() })),
          correctOptionId,
        })),
      };
      const res = editing ? await updateQuiz(groupId, quiz._id, body) : await sendQuiz(groupId, body);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      onSent?.(data);
      successMsg(msg || "quiz.send.sent");
      close();
    } catch (err) {
      errorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t(editing ? "quiz.send.editTitle" : "quiz.send.title")}
      widthClass="md:w-175"
      actions={
        <>
          <Button color="black" variant="text" onClick={close} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button loading={saving} disabled={!valid} onClick={save}>
            {t(editing ? "common.save" : "quiz.send.submit")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {!editing && templates?.length > 0 && (
          <Select
            variant="slate"
            icon={<HiDocumentDuplicate className="text-base" />}
            value={templateId}
            onChange={applyTemplate}
            disabled={loadingTemplate}
            placeholder={t("quiz.send.fromTemplate")}
            options={templates.map((tpl) => ({
              value: tpl._id,
              label: `${tpl.title} (${tpl.questions?.length ?? 0})`,
            }))}
          />
        )}

        {/* Sozlamalar */}
        <div className="grid grid-cols-2 sm:grid-cols-[1fr_9rem_9rem] items-end gap-3">
          <div className="col-span-2 sm:col-span-1">
            <Input
              label={t("quiz.send.titleLabel")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("quiz.send.titlePlaceholder")}
            />
          </div>
          <TimeInput label={t("quiz.send.startAt")} value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          <Input
            label={t("quiz.send.duration")}
            type="number"
            min={1}
            max={180}
            value={durationMin}
            onChange={(e) => setDurationMin(e.target.value)}
            error={durationMin !== "" && !(duration >= 1 && duration <= 180)}
          />
        </div>

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
        />
      </div>
    </Dialog>
  );
}

export default SendQuizDialog;
