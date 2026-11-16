import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiCheck,
  HiCheckCircle,
  HiChevronDown,
  HiChevronRight,
  HiClock,
  HiPaperAirplane,
  HiPencilSquare,
  HiPlayCircle,
  HiQuestionMarkCircle,
  HiTrash,
  HiXMark,
} from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Button from "../../ui/Button";
import Chip from "../../ui/Chip";
import Loading from "../../ui/Loading";
import StudentPhotoAvatar from "../../ui/StudentPhotoAvatar";
import SendQuizDialog from "./SendQuizDialog";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { getQuizzes, getQuiz, deleteQuiz } from "../../api/quiz";
import { errorMsg, successMsg } from "../../utils/alert";

const STATUS_COLOR = { scheduled: "slate", active: "blue", finished: "emerald" };

const STATUS_TILE = {
  scheduled: "bg-slate-100 dark:bg-night-800 text-slate-500 dark:text-slate-400",
  active: "bg-blue-500 text-white",
  finished: "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};
const STATUS_ICON = { scheduled: HiClock, active: HiPlayCircle, finished: HiCheckCircle };

const pad = (n) => String(n).padStart(2, "0");

// Server vaqtlari — unix SONIYA (`getNow()`); brauzer soati bilan solishtirish
// uchun ms ga o'tkaziladi. Ro'yxatda soniya aniqligidagi xato muhim emas.
const fmtLeft = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
};

const fmtWhen = (unixSec, todayLabel) => {
  const d = new Date(unixSec * 1000);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  const day = sameDay ? todayLabel : `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
  return `${day}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const scoreTone = (score) =>
  score >= 8
    ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
    : score >= 5
      ? "bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400"
      : "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400";

/**
 * "Testlar" tabi — guruhdagi testlar ro'yxati (eng oxirgisi birinchi), faol/
 * rejalashtirilgan testlar uchun jonli sanoq, bosilganda natijalar oynasi.
 *
 * @param {Object} props
 * @param {string} props.groupId
 * @param {string} [props.subjectId] - guruh fani, shu fan shablonlarini tanlash uchun
 * @param {boolean} props.canWrite - test yuborish/tahrirlash/o'chirish
 */
function QuizTab({ groupId, subjectId, canWrite }) {
  const { t } = useTranslation();
  const [list, setList] = useState(null);
  const [error, setError] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [editQuiz, setEditQuiz] = useState(null);
  const [openQuizId, setOpenQuizId] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      setError(false);
      const res = await getQuizzes(groupId);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setList(data || []);
    } catch (err) {
      setError(true);
      errorMsg(err.message);
    }
  }, [groupId]);

  // `setTimeout(…, 0)` — loyihadagi react-hooks/set-state-in-effect naqshi.
  useEffect(() => {
    const id = setTimeout(load, 0);
    return () => clearTimeout(id);
  }, [load]);

  // Faol/rejalashtirilgan testlar bor ekan — har soniya qayta render (sanoq).
  useEffect(() => {
    if (!list?.some((q) => q.status !== "finished")) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [list]);

  // Socket izolyatsiya qoidasi (docs/API_CONTRACT_quiz.md): payload.groupId
  // joriy ochiq guruh bilan solishtiriladi — N guruh eventi X guruhga ta'sir
  // qilmaydi.
  const onQuizEvent = useCallback(
    (payload) => {
      if (payload?.groupId !== groupId) return;
      load();
    },
    [groupId, load],
  );
  useSocketEvent("quiz:sent", onQuizEvent);
  useSocketEvent("quiz:started", onQuizEvent);
  useSocketEvent("quiz:finished", onQuizEvent);
  useSocketEvent("quiz:attempt_updated", onQuizEvent);

  if (list === null && !error) {
    return (
      <div className="flex flex-1 items-center justify-center py-10">
        <Loading />
      </div>
    );
  }

  const sendButton = canWrite && (
    <Button className="gap-1.5" onClick={() => setSendOpen(true)}>
      <HiPaperAirplane className="text-base shrink-0 -rotate-45" />
      {t("quiz.send.button")}
    </Button>
  );

  return (
    <div className="flex flex-col flex-1 gap-3">
      {error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-sm text-slate-400 dark:text-slate-500">
          {t("common.error")}
          <Button variant="outlined" color="slate" onClick={load}>
            {t("common.retry")}
          </Button>
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-12 text-center rounded-2xl border border-dashed border-slate-200 dark:border-night-700">
          <span className="grid place-items-center size-14 rounded-2xl bg-blue-50 dark:bg-blue-500/15 text-blue-500 dark:text-blue-400">
            <HiQuestionMarkCircle className="text-3xl" />
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-[15px] font-bold text-slate-800 dark:text-slate-100">{t("quiz.list.empty")}</p>
            <p className="max-w-xs text-[13px] text-slate-500 dark:text-slate-400">{t("quiz.list.emptyHint")}</p>
          </div>
          {sendButton}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {t("quiz.tab")}
              <span className="ml-1.5 font-semibold text-slate-400 dark:text-slate-500 tabular-nums">
                {list.length}
              </span>
            </span>
            {sendButton}
          </div>
          <div className="flex flex-col gap-2">
            {list.map((q) => (
              <QuizRow key={q._id} t={t} quiz={q} now={now} onClick={() => setOpenQuizId(q._id)} />
            ))}
          </div>
        </>
      )}

      {canWrite && (
        <SendQuizDialog
          key={editQuiz?._id || "new"}
          open={sendOpen || !!editQuiz}
          onClose={() => {
            setSendOpen(false);
            setEditQuiz(null);
          }}
          groupId={groupId}
          subjectId={subjectId}
          quiz={editQuiz}
          onSent={load}
        />
      )}

      {openQuizId && (
        <QuizDetailDialog
          groupId={groupId}
          quizId={openQuizId}
          canWrite={canWrite}
          onClose={() => setOpenQuizId(null)}
          onChanged={load}
          onEdit={(quiz) => {
            setOpenQuizId(null);
            setEditQuiz(quiz);
          }}
        />
      )}
    </div>
  );
}

function QuizRow({ t, quiz, now, onClick }) {
  const startMs = quiz.startAt * 1000;
  const endMs = startMs + quiz.totalTimeSec * 1000;
  const StatusIcon = STATUS_ICON[quiz.status];
  const finished = quiz.attemptStats?.finished || 0;
  const total = quiz.attemptStats?.total || 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 p-3 sm:p-3.5 rounded-2xl bg-white dark:bg-night-900 border border-slate-200/70 dark:border-night-700/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none hover:border-blue-300 dark:hover:border-blue-500/40 text-left cursor-pointer transition-colors"
    >
      <span className={`grid place-items-center shrink-0 size-11 rounded-xl ${STATUS_TILE[quiz.status]}`}>
        <StatusIcon className="text-xl" />
      </span>

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
          {quiz.title || t("quiz.list.untitled")}
        </span>
        <span className="text-[12px] leading-snug text-slate-500 dark:text-slate-400">
          {fmtWhen(quiz.startAt, t("quiz.list.today"))} · {t("quiz.list.questionsCount", { n: quiz.questionCount })} ·{" "}
          {t("quiz.list.minutes", { n: Math.round(quiz.totalTimeSec / 60) })}
        </span>
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        {quiz.status === "scheduled" && (
          <>
            <Chip value={t("quiz.list.scheduled")} color="slate" />
            <span className="text-[12px] font-semibold tabular-nums text-slate-500 dark:text-slate-400">
              {t("quiz.list.startsIn", { time: fmtLeft(startMs - now) })}
            </span>
          </>
        )}
        {quiz.status === "active" && (
          <>
            <Chip value={t("quiz.list.active")} color="blue" variant="filled" />
            <span className="text-[12px] font-semibold tabular-nums text-blue-600 dark:text-blue-400">
              {t("quiz.list.endsIn", { time: fmtLeft(endMs - now) })}
            </span>
          </>
        )}
        {quiz.status === "finished" && (
          <>
            <Chip value={t("quiz.list.finished")} color="emerald" />
            <span className="text-[12px] font-semibold tabular-nums text-slate-500 dark:text-slate-400">
              {t("quiz.list.submitted", { finished, total })}
            </span>
          </>
        )}
      </div>
      <HiChevronRight className="hidden sm:block shrink-0 text-base text-slate-300 dark:text-slate-600" />
    </button>
  );
}

function StatTile({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-night-800">
      <span className="text-[11px] font-semibold leading-tight text-slate-400 dark:text-slate-500">{label}</span>
      <span className="text-base font-bold tabular-nums text-slate-800 dark:text-slate-100">{value}</span>
    </div>
  );
}

function QuizDetailDialog({ groupId, quizId, canWrite, onClose, onChanged, onEdit }) {
  const { t } = useTranslation();
  const [quiz, setQuiz] = useState(null);
  const [error, setError] = useState(false);
  const [view, setView] = useState(null); // null → holatga qarab | "results" | "questions"
  const [openStudent, setOpenStudent] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(false);
      const res = await getQuiz(groupId, quizId);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setQuiz(data);
    } catch (err) {
      setError(true);
      errorMsg(err.message);
    }
  }, [groupId, quizId]);

  useEffect(() => {
    const id = setTimeout(load, 0);
    return () => clearTimeout(id);
  }, [load]);

  const onQuizEvent = useCallback(
    (payload) => {
      if (payload?.groupId !== groupId || payload?.quizId !== quizId) return;
      load();
    },
    [groupId, quizId, load],
  );
  useSocketEvent("quiz:sent", onQuizEvent);
  useSocketEvent("quiz:started", onQuizEvent);
  useSocketEvent("quiz:finished", onQuizEvent);
  useSocketEvent("quiz:attempt_updated", onQuizEvent);

  const remove = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      setDeleting(true);
      const res = await deleteQuiz(groupId, quizId);
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg || "quiz.deleted");
      onChanged?.();
      onClose();
    } catch (err) {
      errorMsg(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const total = quiz?.questions?.length || 0;
  const attempts = quiz?.attempts || [];
  // Natija bo'yicha: avval topshirganlar (to'g'ri javob soni kamayishi bo'yicha).
  const sorted = [...attempts].sort(
    (a, b) => Number(!!b.startedAt) - Number(!!a.startedAt) || (b.correctCount || 0) - (a.correctCount || 0),
  );
  const participants = attempts.filter((a) => a.startedAt);
  const done = participants.filter((a) => a.finishedAt);
  const avg = done.length ? Math.round((done.reduce((s, a) => s + (a.score || 0), 0) / done.length) * 10) / 10 : null;
  const activeView = view || (quiz?.status === "scheduled" ? "questions" : "results");
  const canEdit = canWrite && quiz?.status === "scheduled";
  const canDelete = canWrite && quiz && quiz.status !== "active";

  return (
    <Dialog
      open
      onClose={onClose}
      title={quiz?.title || t(quiz ? "quiz.list.untitled" : "quiz.results.title")}
      widthClass="md:w-175"
      actions={
        quiz && (canEdit || canDelete) ? (
          <>
            {canDelete && (
              <Button color="red" variant="text" className="gap-1.5" loading={deleting} onClick={remove}>
                <HiTrash className="text-base" />
                {t(confirmDelete ? "quiz.results.confirmDelete" : "common.delete")}
              </Button>
            )}
            {canEdit && (
              <Button variant="outlined" color="slate" className="gap-1.5" onClick={() => onEdit(quiz)}>
                <HiPencilSquare className="text-base" />
                {t("common.edit")}
              </Button>
            )}
          </>
        ) : undefined
      }
    >
      {!quiz && !error ? (
        <div className="flex items-center justify-center py-10">
          <Loading />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-sm text-slate-400 dark:text-slate-500">
          {t("common.error")}
          <Button variant="outlined" color="slate" onClick={load}>
            {t("common.retry")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 flex-wrap text-[12px] text-slate-500 dark:text-slate-400">
            <Chip value={t(`quiz.list.${quiz.status}`)} color={STATUS_COLOR[quiz.status]} />
            <span>
              {fmtWhen(quiz.startAt, t("quiz.list.today"))} ·{" "}
              {t("quiz.list.minutes", { n: Math.round(quiz.totalTimeSec / 60) })}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <StatTile label={t("quiz.results.statQuestions")} value={total} />
            <StatTile label={t("quiz.results.statSubmitted")} value={`${done.length}/${attempts.length}`} />
            <StatTile label={t("quiz.results.statAverage")} value={avg ?? "—"} />
          </div>

          {/* Ko'rinish almashtirgich */}
          <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 dark:bg-night-800">
            {["results", "questions"].map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                className={`h-8 rounded-lg text-[13px] font-semibold cursor-pointer transition-colors ${
                  activeView === key
                    ? "bg-white dark:bg-night-900 text-slate-900 dark:text-slate-100 shadow-[0_1px_2px_rgba(15,23,42,0.08)]"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
              >
                {t(key === "results" ? "quiz.results.title" : "quiz.send.questions")}
              </button>
            ))}
          </div>

          {activeView === "questions" ? (
            <div className="flex flex-col gap-2">
              {quiz.questions.map((q, qi) => (
                <div
                  key={q._id}
                  className="flex flex-col gap-2 p-3 rounded-2xl border border-slate-200 dark:border-night-700"
                >
                  <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                    {qi + 1}. {q.text}
                  </span>
                  <div className="grid sm:grid-cols-2 gap-1.5">
                    {q.options.map((o) => {
                      const correct = o.id === q.correctOptionId;
                      return (
                        <div
                          key={o.id}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[13px] ${
                            correct
                              ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold"
                              : "bg-slate-50 dark:bg-night-800 text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          <span className="uppercase font-bold">{o.id}</span>
                          <span className="flex-1 min-w-0 break-words">{o.text}</span>
                          {correct && <HiCheck className="shrink-0 text-sm" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : attempts.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-slate-400 dark:text-slate-500">
              {t("quiz.results.noAttempts")}
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {sorted.map((a) => {
                const studentId = a.student?._id || a.student;
                const open = openStudent === studentId;
                const joined = !!a.startedAt;
                return (
                  <div
                    key={studentId}
                    className={`rounded-xl border ${
                      open
                        ? "border-blue-200 dark:border-blue-500/30"
                        : "border-slate-200/70 dark:border-night-700/70"
                    }`}
                  >
                    <button
                      type="button"
                      disabled={!joined}
                      onClick={() => setOpenStudent(open ? null : studentId)}
                      className={`flex items-center gap-2.5 w-full p-2.5 text-left ${
                        joined ? "cursor-pointer" : "cursor-default"
                      }`}
                    >
                      <StudentPhotoAvatar student={a.student} size={32} rounded="rounded-full" />
                      <span
                        className={`flex-1 min-w-0 text-[13px] font-semibold truncate ${
                          joined ? "text-slate-800 dark:text-slate-100" : "text-slate-400 dark:text-slate-500"
                        }`}
                      >
                        {a.student?.fullName || "—"}
                      </span>
                      {joined ? (
                        <>
                          <span className="text-[12px] font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                            {t("quiz.results.correctOf", { correct: a.correctCount || 0, total })}
                          </span>
                          {a.finishedAt ? (
                            <span
                              className={`grid place-items-center shrink-0 min-w-8 h-7 px-1.5 rounded-lg text-[13px] font-bold tabular-nums ${scoreTone(a.score)}`}
                            >
                              {a.score}
                            </span>
                          ) : (
                            <Chip value={t("quiz.results.inProgress")} color="blue" />
                          )}
                          <HiChevronDown
                            className={`shrink-0 text-sm text-slate-400 ${open ? "rotate-180" : ""}`}
                          />
                        </>
                      ) : (
                        <span className="text-[12px] text-slate-400 dark:text-slate-500">
                          {t(quiz.status === "finished" ? "quiz.results.notJoined" : "quiz.results.waiting")}
                        </span>
                      )}
                    </button>

                    {open && (
                      <div className="flex flex-col gap-1.5 px-2.5 pb-2.5">
                        {quiz.questions.map((q, qi) => {
                          const ans = a.answers?.find((x) => x.questionId === q._id);
                          const chosen = q.options.find((o) => o.id === ans?.optionId);
                          const right = q.options.find((o) => o.id === q.correctOptionId);
                          return (
                            <div
                              key={q._id}
                              className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-slate-50 dark:bg-night-800"
                            >
                              <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                                {qi + 1}. {q.text}
                              </span>
                              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-1.5 text-[12px]">
                                <AnswerPill
                                  tone={ans?.correct ? "ok" : chosen ? "bad" : "none"}
                                  label={t("quiz.results.chosen")}
                                  value={chosen ? `${chosen.id.toUpperCase()}. ${chosen.text}` : t("quiz.results.noAnswer")}
                                />
                                {!ans?.correct && right && (
                                  <AnswerPill
                                    tone="ok"
                                    label={t("quiz.results.correct")}
                                    value={`${right.id.toUpperCase()}. ${right.text}`}
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}

function AnswerPill({ tone, label, value }) {
  const tones = {
    ok: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    bad: "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400",
    none: "bg-slate-200/60 dark:bg-night-700 text-slate-500 dark:text-slate-400",
  };
  const Icon = tone === "ok" ? HiCheck : HiXMark;
  return (
    <span className={`inline-flex items-start gap-1.5 px-2 py-1 rounded-lg ${tones[tone]}`}>
      <Icon className="shrink-0 mt-0.5 text-sm" />
      <span className="min-w-0 break-words">
        <span className="font-normal opacity-80">{label}: </span>
        <span className="font-semibold">{value}</span>
      </span>
    </span>
  );
}

export default QuizTab;
