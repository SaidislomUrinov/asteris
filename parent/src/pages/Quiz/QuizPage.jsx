import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  HiCheck,
  HiCheckCircle,
  HiOutlineClock,
  HiOutlineFaceFrown,
  HiXMark,
} from "react-icons/hi2";
import { Page } from "../../components/Page";
import { Card, Pill } from "../../components/Card";
import { Button } from "../../components/Button";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ListSkeleton } from "../../components/Skeleton";
import { ErrorState } from "../../components/States";
import { haptic, tg } from "../../lib/telegram";
import { cn } from "../../utils/cn";
import { getQuizState, startQuiz, answerQuiz, finishQuiz, getQuizResult } from "../../api/parent";

const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"];
const pad = (n) => String(n).padStart(2, "0");

const fmt = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
};

/**
 * Test topshirish sahifasi — bot "Testni boshlash" tugmasi (web_app URL
 * `/quiz/:entryId/:quizId`) orqali ochiladi. Oqim:
 *   state → [boshlanishigacha sanoq] → start → savollar (umumiy vaqt, javobni
 *   o'zgartirish mumkin) → finish (qo'lda yoki vaqt tugaganda) → natija.
 *
 * Server vaqtlari unix SONIYA — bu yerda ms ga o'tkaziladi. Barcha sanoqlar
 * server soatiga nisbatan (`offset`), qurilma soati noto'g'ri bo'lsa ham
 * test hammada bir vaqtda boshlanib-tugaydi.
 */
export function QuizPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { entryId, quizId } = useParams();
  const [phase, setPhase] = useState("loading"); // loading|countdown|quiz|finishing|result|missed
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null); // { startAtMs, endAtMs, totalTimeSec }
  const [offset, setOffset] = useState(0); // server soati − qurilma soati (ms)
  const [now, setNow] = useState(() => Date.now());
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({}); // questionId → optionId
  const [qIndex, setQIndex] = useState(0);
  const [result, setResult] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [covered, setCovered] = useState(false);
  const failedRef = useRef(new Set()); // saqlanmay qolgan javoblar (tarmoq)
  const beginRef = useRef(false);
  const finishRef = useRef(false);

  const applyTiming = useCallback((data) => {
    setOffset(data.serverNow * 1000 - Date.now());
    setInfo({
      startAtMs: data.startAt * 1000,
      endAtMs: (data.startAt + data.totalTimeSec) * 1000,
      totalTimeSec: data.totalTimeSec,
    });
  }, []);

  const showResult = useCallback(async () => {
    const r = await getQuizResult(entryId, quizId);
    setResult(r);
    setPhase(r.joined ? "result" : "missed");
  }, [entryId, quizId]);

  // Testni boshlash (yoki davom ettirish — belgilangan javoblar tiklanadi).
  const begin = useCallback(async () => {
    if (beginRef.current) return;
    beginRef.current = true;
    try {
      const data = await startQuiz(entryId, quizId);
      applyTiming(data);
      setQuestions(data.questions || []);
      setAnswers(
        Object.fromEntries((data.answers || []).filter((a) => a.optionId).map((a) => [a.questionId, a.optionId])),
      );
      if (data.finishedAt) await showResult();
      else setPhase("quiz");
    } catch (e) {
      beginRef.current = false;
      // Qurilma soati biroz oldinda — server hali "boshlanmadi" deydi: sanoq
      // fazasiga qaytamiz, u keyingi tick'da qayta urinadi.
      if (e?.code === "quiz.notStarted") setPhase("countdown");
      else if (e?.code === "quiz.finished") setPhase("missed");
      else setError(e);
    }
  }, [entryId, quizId, applyTiming, showResult]);

  // Dastlabki yuklash. `setTimeout(…, 0)` — react-hooks/set-state-in-effect naqshi.
  useEffect(() => {
    const id = setTimeout(async () => {
      try {
        const data = await getQuizState(entryId, quizId);
        applyTiming(data);
        if (data.attempt?.finishedAt) await showResult();
        else if (data.status === "finished") setPhase("missed");
        else if (data.startAt <= data.serverNow) await begin();
        else setPhase("countdown");
      } catch (e) {
        setError(e);
      }
    }, 0);
    return () => clearTimeout(id);
  }, [entryId, quizId, applyTiming, showResult, begin]);

  // Sanoq uchun tick.
  useEffect(() => {
    if (phase !== "countdown" && phase !== "quiz") return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [phase]);

  // Kutish paytida vaqt-vaqti bilan qayta sinxronlash — o'qituvchi boshlanish
  // vaqtini o'zgartirgan yoki testni o'chirgan bo'lishi mumkin.
  useEffect(() => {
    if (phase !== "countdown") return;
    const id = setInterval(async () => {
      try {
        applyTiming(await getQuizState(entryId, quizId));
      } catch (e) {
        setError(e);
      }
    }, 20000);
    return () => clearInterval(id);
  }, [phase, entryId, quizId, applyTiming]);

  const serverNow = now + offset;

  const doFinish = useCallback(async () => {
    if (finishRef.current) return;
    finishRef.current = true;
    setConfirmOpen(false);
    setPhase("finishing");
    try {
      // Tarmoq uzilib saqlanmay qolgan javoblarni oxirgi marta yuboramiz.
      for (const questionId of failedRef.current) {
        await answerQuiz(entryId, quizId, questionId, answers[questionId]).catch(() => {});
      }
      await finishQuiz(entryId, quizId);
      haptic("success");
      await showResult();
    } catch (e) {
      setError(e);
    }
  }, [entryId, quizId, answers, showResult]);

  // Sanoq tugadi → test boshlanadi; umumiy vaqt tugadi → avtomatik yakun.
  useEffect(() => {
    if (!info) return;
    if (phase === "countdown" && serverNow >= info.startAtMs) {
      const id = setTimeout(begin, 0);
      return () => clearTimeout(id);
    }
    if (phase === "quiz" && serverNow >= info.endAtMs) {
      const id = setTimeout(doFinish, 0);
      return () => clearTimeout(id);
    }
  }, [phase, serverNow, info, begin, doFinish]);

  // Test paytida: tasodifan yopib yubormaslik uchun Telegram tasdig'i; ilova
  // fonga o'tganda (oxirgi ilovalar ko'rinishi) savollar yopib qo'yiladi.
  useEffect(() => {
    if (phase !== "quiz") return;
    tg()?.enableClosingConfirmation?.();
    const onHide = () => setCovered(document.hidden);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      tg()?.disableClosingConfirmation?.();
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [phase]);

  const select = async (question, optionId) => {
    if (answers[question._id] === optionId) return;
    haptic("light");
    setAnswers((prev) => ({ ...prev, [question._id]: optionId }));
    try {
      await answerQuiz(entryId, quizId, question._id, optionId);
      failedRef.current.delete(question._id);
    } catch {
      failedRef.current.add(question._id);
    }
  };

  if (error) {
    return (
      <Page withTabBar={false}>
        <ErrorState error={error} onRetry={() => window.location.reload()} />
      </Page>
    );
  }

  if (phase === "loading" || phase === "finishing") {
    return (
      <Page withTabBar={false}>
        <ListSkeleton count={3} />
      </Page>
    );
  }

  if (phase === "countdown") {
    return (
      <QuizShell>
        <div className="flex-1 flex flex-col items-center justify-center gap-6 py-10 text-center">
          <span className="w-16 h-16 rounded-2xl bg-accent/10 text-accent grid place-items-center">
            <HiOutlineClock className="w-8 h-8" />
          </span>
          <div className="flex flex-col items-center gap-1">
            <span className="font-title text-xl font-bold text-ink">{t("quiz.countdown.title")}</span>
            <span className="text-sm text-hint">{t("quiz.countdown.startingIn")}</span>
          </div>
          <span className="font-jet text-[56px] min-[380px]:text-[64px] leading-none font-extrabold tabular-nums text-accent tracking-tight">
            {fmt(info.startAtMs - serverNow)}
          </span>
          <Pill tone="acc" className="!text-[13px] !px-3 !py-1">
            {t("quiz.countdown.duration", { n: Math.round(info.totalTimeSec / 60) })}
          </Pill>
          <p className="text-[13px] text-hint max-w-[30ch]">{t("quiz.countdown.keepOpen")}</p>
        </div>
      </QuizShell>
    );
  }

  if (phase === "missed") {
    return (
      <QuizShell>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-10 text-center">
          <span className="w-16 h-16 rounded-2xl bg-ink/6 text-hint grid place-items-center">
            <HiOutlineFaceFrown className="w-8 h-8" />
          </span>
          <div className="flex flex-col items-center gap-1">
            <span className="font-title text-xl font-bold text-ink">{t("quiz.missed.title")}</span>
            <span className="text-sm text-hint max-w-[30ch]">{t("quiz.missed.text")}</span>
          </div>
          <Button variant="soft" className="w-auto px-6" onClick={() => navigate("/", { replace: true })}>
            {t("quiz.result.home")}
          </Button>
        </div>
      </QuizShell>
    );
  }

  if (phase === "result") {
    const total = result?.total ?? 0;
    const correct = result?.correctCount ?? 0;
    const pct = total ? Math.round((correct / total) * 100) : 0;
    const tier = pct >= 80 ? "excellent" : pct >= 50 ? "good" : "tryAgain";
    const ring = pct >= 80 ? "text-ok" : pct >= 50 ? "text-accent" : "text-warn";
    const answerOf = new Map((result?.answers || []).map((a) => [a.questionId, a]));
    return (
      <QuizShell>
        <div className="flex flex-col items-center gap-4 pt-6 pb-2 text-center">
          <div className={`relative w-36 h-36 grid place-items-center ${ring}`}>
            <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
              <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="9" />
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke="currentColor"
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 44}`}
                strokeDashoffset={`${2 * Math.PI * 44 * (1 - pct / 100)}`}
              />
            </svg>
            <div className="flex flex-col items-center leading-none gap-1">
              <span className="font-jet text-3xl font-extrabold tabular-nums text-ink">
                {correct}/{total}
              </span>
              <span className="text-[11px] font-semibold text-hint">{t("quiz.result.correctLabel")}</span>
            </div>
          </div>
          <span className="font-title text-xl font-bold text-ink">{t(`quiz.result.${tier}`)}</span>
          {result?.score != null && (
            <Pill tone="acc" className="!text-[14px] !px-3.5 !py-1.5">
              {t("quiz.result.score", { score: result.score })}
            </Pill>
          )}
        </div>

        {result?.reviewable && result.questions?.length ? (
          <div className="flex flex-col gap-2.5 mt-2">
            <span className="font-title text-[15px] font-bold text-ink">{t("quiz.result.review")}</span>
            {result.questions.map((q, i) => {
              const ans = answerOf.get(q._id);
              const chosenIdx = q.options.findIndex((o) => o.id === ans?.optionId);
              const rightIdx = q.options.findIndex((o) => o.id === q.correctOptionId);
              return (
                <Card key={q._id} className="flex flex-col gap-2">
                  <p className="text-[14px] font-bold text-ink leading-snug break-words">
                    {i + 1}. {q.text}
                  </p>
                  <ReviewLine
                    ok={!!ans?.correct}
                    muted={chosenIdx < 0}
                    label={t("quiz.result.yourAnswer")}
                    value={
                      chosenIdx >= 0
                        ? `${OPTION_LABELS[chosenIdx]}. ${q.options[chosenIdx].text}`
                        : t("quiz.result.noAnswer")
                    }
                  />
                  {!ans?.correct && rightIdx >= 0 && (
                    <ReviewLine
                      ok
                      label={t("quiz.result.correctAnswer")}
                      value={`${OPTION_LABELS[rightIdx]}. ${q.options[rightIdx].text}`}
                    />
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          <p className="text-[13px] text-hint text-center">{t("quiz.result.reviewLater")}</p>
        )}

        <Button variant="soft" className="mt-2" onClick={() => navigate("/", { replace: true })}>
          {t("quiz.result.home")}
        </Button>
      </QuizShell>
    );
  }

  // ===== Test jarayoni =====
  const question = questions[qIndex];
  if (!question) {
    return (
      <Page withTabBar={false}>
        <ListSkeleton count={2} />
      </Page>
    );
  }

  const left = Math.max(0, info.endAtMs - serverNow);
  const leftPct = Math.max(0, Math.min(100, (left / (info.totalTimeSec * 1000)) * 100));
  const urgent = left <= 30000;
  const answeredCount = questions.filter((q) => answers[q._id]).length;
  const unanswered = questions.length - answeredCount;
  const isLast = qIndex === questions.length - 1;
  const chosen = answers[question._id];

  return (
    <QuizShell>
      {/* Yuqori panel: nechanchi savol + umumiy qolgan vaqt */}
      <div className="sticky top-0 z-10 -mx-4 px-4 pt-1 pb-2.5 bg-bg flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="font-title text-[15px] font-bold text-ink">
            {t("quiz.question.progress", { current: qIndex + 1, total: questions.length })}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-jet text-[15px] font-extrabold tabular-nums",
              urgent ? "bg-bad-bg text-bad" : "bg-accent/10 text-accent",
            )}
          >
            <HiOutlineClock className="w-4 h-4" />
            {fmt(left)}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-ink/8 overflow-hidden">
          <div className={cn("h-full rounded-full", urgent ? "bg-bad" : "bg-accent")} style={{ width: `${leftPct}%` }} />
        </div>
        {/* Savollar tasmasi — istalgan savolga o'tish; belgilanganlari bo'yalgan */}
        <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-0.5 [scrollbar-width:none]">
          {questions.map((q, i) => (
            <button
              key={q._id}
              type="button"
              onClick={() => setQIndex(i)}
              className={cn(
                "shrink-0 w-9 h-9 rounded-xl grid place-items-center font-jet text-[13px] font-bold tabular-nums",
                i === qIndex
                  ? "bg-accent text-accent-fg"
                  : answers[q._id]
                    ? "bg-accent/15 text-accent"
                    : "bg-ink/6 text-hint",
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      {covered ? (
        <div className="flex-1 grid place-items-center text-sm text-hint">{t("quiz.question.covered")}</div>
      ) : (
        <Card className="flex flex-col gap-4">
          <p className="text-[17px] font-bold text-ink leading-snug break-words">{question.text}</p>
          <div className="flex flex-col gap-2.5">
            {question.options.map((o, i) => {
              const isChosen = chosen === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => select(question, o.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3.5 py-3.5 text-left text-[15px] font-semibold transition-colors duration-150",
                    isChosen ? "bg-accent text-accent-fg" : "bg-ink/5 text-ink active:bg-ink/10",
                  )}
                >
                  <span
                    className={cn(
                      "shrink-0 w-8 h-8 rounded-full grid place-items-center text-[13px] font-black",
                      isChosen ? "bg-black/15" : "bg-ink/8 text-hint",
                    )}
                  >
                    {isChosen ? <HiCheck className="w-4 h-4" /> : OPTION_LABELS[i]}
                  </span>
                  <span className="flex-1 min-w-0 break-words">{o.text}</span>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      <div className="flex-1" />

      {/* Pastki panel: navigatsiya + yakunlash */}
      <div
        className="sticky bottom-0 -mx-4 px-4 pt-2.5 bg-bg flex flex-col gap-2"
        style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}
      >
        <span className="text-[12px] font-semibold text-hint text-center">
          {t("quiz.question.answered", { done: answeredCount, total: questions.length })}
        </span>
        <div className="flex gap-2.5">
          <Button variant="soft" disabled={qIndex === 0} onClick={() => setQIndex((i) => Math.max(0, i - 1))}>
            {t("quiz.question.prev")}
          </Button>
          {isLast ? (
            <Button onClick={() => setConfirmOpen(true)}>
              <HiCheckCircle className="w-5 h-5" />
              {t("quiz.question.finish")}
            </Button>
          ) : (
            <Button onClick={() => setQIndex((i) => Math.min(questions.length - 1, i + 1))}>
              {t("quiz.question.next")}
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={t("quiz.question.finishTitle")}
        text={
          unanswered > 0 ? t("quiz.question.finishUnanswered", { n: unanswered }) : t("quiz.question.finishText")
        }
        confirmText={t("quiz.question.finish")}
        cancelText={t("quiz.question.back")}
        onConfirm={doFinish}
        onClose={() => setConfirmOpen(false)}
      />
    </QuizShell>
  );
}

function ReviewLine({ ok, muted, label, value }) {
  const Icon = ok ? HiCheck : HiXMark;
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-xl px-3 py-2 text-[13px]",
        ok ? "bg-ok-bg text-ok" : muted ? "bg-ink/6 text-hint" : "bg-bad-bg text-bad",
      )}
    >
      <Icon className="w-4 h-4 shrink-0 mt-0.5" />
      <span className="min-w-0 break-words">
        <span className="opacity-80">{label}: </span>
        <span className="font-bold">{value}</span>
      </span>
    </div>
  );
}

// Nusxalash/skrinshot urinishini qiyinlashtiradi — 100% himoya BERMAYDI
// (brauzer/OS darajasida ekran suratini to'liq bloklash mumkin emas), faqat
// oson nusxalash/tanlashni to'xtatadi.
function QuizShell({ children }) {
  return (
    <Page withTabBar={false}>
      <div
        onContextMenu={(e) => e.preventDefault()}
        onCopy={(e) => e.preventDefault()}
        onCut={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
        style={{
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
        }}
        className="flex flex-1 flex-col gap-3 min-h-[calc(100dvh-88px)] pb-4"
      >
        {children}
      </div>
    </Page>
  );
}
