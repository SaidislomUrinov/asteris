import { useTranslation } from "react-i18next";
import { HiArrowDownTray, HiArrowRight, HiArrowUp, HiArrowUpTray, HiCheck, HiOutlinePencilSquare, HiOutlineTableCells } from "react-icons/hi2";

const TONES = [
  {
    cell: "bg-blue-50 dark:bg-blue-500/15 border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300",
    rail: "bg-blue-400 dark:bg-blue-500",
    soft: "bg-blue-50/60 dark:bg-blue-500/10",
  },
  {
    cell: "bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300",
    rail: "bg-amber-400 dark:bg-amber-500",
    soft: "bg-amber-50/60 dark:bg-amber-500/10",
  },
];

const HEAD = "px-1.5 py-1.5 text-[11px] font-semibold leading-tight bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30";
const CELL = "px-1.5 py-1.5 text-[11px] leading-tight border border-slate-200 dark:border-night-700 text-slate-600 dark:text-slate-300 min-w-0 break-words";

/** Excel jadvalining sxemasi: modul ustuni birinchi qatorda, keyingilari bo'sh. */
function Sheet({ plan, t }) {
  const cols = plan
    ? ["colModule", "colTitle", "colDescription", "colHomework"]
    : ["colTitle", "colDescription", "colHomework"];
  const grid = plan ? "grid-cols-[1.25fr_1fr_0.9fr_1fr]" : "grid-cols-[1.2fr_1fr_1fr]";
  const lesson = (n) => t("teachingPlan.import.sampleLesson", { n });
  // [moduleIdx, moduleLabel|null, lesson]
  const rows = plan ? [[0, 1, 1], [0, null, 2], [1, 2, 3]] : [[0, null, 1], [0, null, 2], [0, null, 3]];

  return (
    <div className="min-w-0 flex flex-col gap-1.5">
      <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        <HiOutlineTableCells className="text-sm shrink-0" />
        Excel
      </span>
      <div className={`grid ${grid} rounded-lg overflow-hidden bg-white dark:bg-night-900`}>
        {cols.map((c) => (
          <div key={c} className={HEAD}>
            {t(`teachingPlan.import.${c}`)}
          </div>
        ))}
        {rows.map(([mi, label, n], ri) => (
          <div key={ri} className="contents">
            {plan &&
              (label ? (
                <div className={`${CELL} font-semibold ${TONES[mi].cell}`}>{t("teachingPlan.import.sampleModule", { n: label })}</div>
              ) : (
                <div className={`${CELL} relative pl-2.5 flex items-center gap-1 italic text-slate-400 dark:text-slate-500 ${TONES[mi].soft}`}>
                  <span className={`absolute left-0 inset-y-0 w-1 ${TONES[mi].rail}`} />
                  <HiArrowUp className="shrink-0 text-xs" />
                  <span className="hidden sm:inline text-[10px] leading-tight">{t("teachingPlan.import.sameModule")}</span>
                </div>
              ))}
            <div className={`${CELL} ${plan ? "" : "font-medium"}`}>{lesson(n)}</div>
            <div className={CELL}>…</div>
            <div className={CELL}>…</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Natija: modul kartochkalari ichidagi darslar. */
function Result({ plan, t }) {
  const lesson = (n) => (
    <div key={n} className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 text-[11px] text-slate-600 dark:text-slate-300">
      <span className="tabular-nums text-slate-400 dark:text-slate-500">{n}</span>
      <span className="truncate">{t("teachingPlan.import.sampleLesson", { n })}</span>
    </div>
  );
  const card = (mi, label, lessons) => (
    <div key={mi} className={`flex flex-col gap-1 p-2 rounded-lg border ${TONES[mi].cell}`}>
      {label && <span className="text-[11px] font-semibold">{t("teachingPlan.import.sampleModule", { n: label })}</span>}
      {lessons.map(lesson)}
    </div>
  );
  return (
    <div className="min-w-0 flex flex-col gap-1.5">
      <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        <HiOutlinePencilSquare className="text-sm shrink-0" />
        {t("teachingPlan.import.guideResult")}
      </span>
      <div className="flex flex-col gap-2">{plan ? [card(0, 1, [1, 2]), card(1, 2, [3])] : card(0, null, [1, 2, 3])}</div>
    </div>
  );
}

const STEPS = [
  { key: "stepDownload", Glyph: HiArrowDownTray },
  { key: "stepFill", Glyph: HiOutlineTableCells },
  { key: "stepUpload", Glyph: HiArrowUpTray },
  { key: "stepReview", Glyph: HiOutlinePencilSquare },
  { key: "stepSave", Glyph: HiCheck },
];

/**
 * "Qanday to'ldiriladi" — qadamlar + Excel sxemasi va natija (light + dark).
 * docs/API_CONTRACT_teaching_plan_excel_import.md §0.
 *
 * @param {Object} props
 * @param {"plan"|"lessons"} props.kind
 */
export default function PlanImportGuide({ kind }) {
  const { t } = useTranslation();
  const plan = kind === "plan";
  const label = t(plan ? "teachingPlan.import.guidePlan" : "teachingPlan.import.guideLessons");

  return (
    <figure role="img" aria-label={label} className="flex flex-col gap-3 m-0 p-3 rounded-2xl border border-slate-200 dark:border-night-700 bg-slate-50/60 dark:bg-night-800/40">
      <ol className="flex flex-wrap sm:grid sm:grid-cols-5 gap-1.5 sm:gap-1 m-0 p-0 list-none">
        {STEPS.map((step, i) => (
          <li key={step.key} className="flex items-center sm:flex-col gap-1.5 sm:gap-1 sm:text-center min-w-0 pr-2.5 sm:pr-0 rounded-full sm:rounded-none border sm:border-0 border-slate-200 dark:border-night-700 bg-white sm:bg-transparent dark:bg-night-900 sm:dark:bg-transparent">
            <span className="relative w-8 h-8 shrink-0 rounded-full flex items-center justify-center bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 text-base">
              <step.Glyph />
              <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                {i + 1}
              </span>
            </span>
            <span className="text-[11px] font-medium leading-tight text-slate-600 dark:text-slate-300 break-words max-w-full">
              {t(`teachingPlan.import.${step.key}`)}
            </span>
          </li>
        ))}
      </ol>
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.6fr)_auto_minmax(0,1fr)] gap-2 sm:gap-3 items-center">
        <Sheet plan={plan} t={t} />
        <HiArrowRight className="hidden sm:block text-xl text-slate-300 dark:text-slate-600 mt-5" />
        <HiArrowRight className="sm:hidden justify-self-center rotate-90 text-xl text-slate-300 dark:text-slate-600" />
        <Result plan={plan} t={t} />
      </div>
      <figcaption className="text-xs text-slate-500 dark:text-slate-400">{label}</figcaption>
    </figure>
  );
}
