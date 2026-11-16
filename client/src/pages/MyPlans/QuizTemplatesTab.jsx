import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiPaperAirplane,
  HiPencilSquare,
  HiPlus,
  HiQuestionMarkCircle,
  HiTrash,
} from "react-icons/hi2";
import Button from "../../ui/Button";
import Dialog from "../../ui/Dialog";
import PlanCardSkeleton from "./PlanCardSkeleton";
import QuizTemplateDialog from "./QuizTemplateDialog";
import SendTemplateDialog from "./SendTemplateDialog";
import { listQuizTemplates, deleteQuizTemplate } from "../../api/quiz";
import { errorMsg, successMsg } from "../../utils/alert";

const SKELETON_COUNT = 6;

/**
 * "Testlar" tabi (Dars rejalari ichida) — o'qituvchining fanga bog'langan
 * test shablonlari ro'yxati (API_CONTRACT_quiz_templates.md). Shablondan
 * istalgan vaqt tanlangan guruhiga haqiqiy test yuboriladi.
 *
 * @param {Object} props
 * @param {Array<{_id, name}>} props.subjects
 * @param {string} props.subject - joriy fan filtri ("" = Barchasi)
 */
function QuizTemplatesTab({ subjects, subject }) {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState(null);
  const [error, setError] = useState(false);
  const [editTemplate, setEditTemplate] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const [sendTemplate, setSendTemplate] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(false);
      const res = await listQuizTemplates(subject || undefined);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setTemplates(data || []);
    } catch (err) {
      setError(true);
      errorMsg(err.message);
    }
  }, [subject]);

  useEffect(() => {
    const id = setTimeout(load, 0);
    return () => clearTimeout(id);
  }, [load]);

  const openCreate = () => {
    setDialogKey((k) => k + 1);
    setCreateOpen(true);
  };

  const remove = async () => {
    const id = deleteTarget?._id;
    if (!id) return;
    try {
      setDeletingId(id);
      const res = await deleteQuizTemplate(id);
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg || "quiz.template.deleted");
      setTemplates((prev) => prev.filter((p) => p._id !== id));
      setDeleteTarget(null);
    } catch (err) {
      errorMsg(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  if (templates === null && !error) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {Array.from({ length: SKELETON_COUNT }, (_, i) => (
          <PlanCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end">
        <Button onClick={openCreate} className="gap-1.5">
          <HiPlus className="text-base" />
          {t("quiz.template.create")}
        </Button>
      </div>

      {error ? (
        <div className="flex flex-col flex-1 items-center justify-center gap-2 py-12 text-center">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{t("common.error")}</p>
          <Button variant="outlined" color="black" onClick={load}>
            {t("common.retry")}
          </Button>
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col flex-1 items-center justify-center gap-2 py-12 text-center">
          <span className="flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-50 dark:bg-night-800 text-2xl text-slate-300 dark:text-slate-600">
            <HiQuestionMarkCircle />
          </span>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{t("quiz.template.empty")}</p>
          <Button className="gap-1.5 mt-1" onClick={openCreate}>
            <HiPlus className="text-base" />
            {t("quiz.template.create")}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {templates.map((tpl) => (
            <TemplateCard
              key={tpl._id}
              t={t}
              template={tpl}
              deleting={deletingId === tpl._id}
              onEdit={() => setEditTemplate(tpl)}
              onSend={() => setSendTemplate(tpl)}
              onDelete={() => setDeleteTarget(tpl)}
            />
          ))}
        </div>
      )}

      <QuizTemplateDialog
        key={`create-${dialogKey}`}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        subjects={subjects}
        defaultSubject={subject}
        onSaved={() => load()}
      />

      {editTemplate && (
        <QuizTemplateDialog
          key={editTemplate._id}
          open
          onClose={() => setEditTemplate(null)}
          template={editTemplate}
          subjects={subjects}
          onSaved={() => load()}
        />
      )}

      {sendTemplate && (
        <SendTemplateDialog
          key={sendTemplate._id}
          open
          onClose={() => setSendTemplate(null)}
          template={sendTemplate}
        />
      )}

      <Dialog
        open={!!deleteTarget}
        onClose={() => {
          if (deletingId) return;
          setDeleteTarget(null);
        }}
        title={t("quiz.template.deleteTitle")}
        widthClass="sm:w-100"
        actions={
          <>
            <Button color="black" variant="text" onClick={() => setDeleteTarget(null)} disabled={!!deletingId}>
              {t("common.cancel")}
            </Button>
            <Button color="red" loading={!!deletingId} onClick={remove}>
              {t("common.delete")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {t("quiz.template.deleteConfirm", { title: deleteTarget?.title || "" })}
        </p>
      </Dialog>
    </div>
  );
}

function TemplateCard({ t, template, deleting, onEdit, onSend, onDelete }) {
  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 shadow-sm dark:shadow-none shadow-slate-900/[0.02]">
      <div className="flex items-start gap-3">
        <span className="flex items-center justify-center w-10 h-10 shrink-0 rounded-xl bg-blue-50 dark:bg-blue-500/15 text-lg text-blue-500">
          <HiQuestionMarkCircle />
        </span>
        <div className="flex flex-col min-w-0 flex-1 gap-1">
          <span className="text-[15px] font-semibold text-slate-800 dark:text-slate-100 leading-snug line-clamp-2 break-words">
            {template.title}
          </span>
          {template.subject?.name && (
            <span className="self-start max-w-full truncate px-2 py-0.5 rounded-md bg-violet-50 dark:bg-violet-500/15 text-[11px] font-semibold text-violet-600 dark:text-violet-400">
              {template.subject.name}
            </span>
          )}
        </div>
      </div>

      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
        {t("quiz.list.questionsCount", { n: template.questions?.length ?? template.questionCount ?? 0 })}
      </span>

      <div className="flex items-center gap-2 pt-3 mt-auto border-t border-slate-100 dark:border-night-700">
        <Button className="flex-1 gap-1.5" onClick={onSend}>
          <HiPaperAirplane className="text-base shrink-0 -rotate-45" />
          {t("quiz.template.send")}
        </Button>
        <Button variant="outlined" color="slate" onClick={onEdit} title={t("quiz.template.edit")}>
          <HiPencilSquare className="text-base" />
        </Button>
        <Button variant="outlined" color="slate" loading={deleting} onClick={onDelete} title={t("common.delete")}>
          <HiTrash className="text-base" />
        </Button>
      </div>
    </div>
  );
}

export default QuizTemplatesTab;
