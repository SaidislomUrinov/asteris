import { useRef } from "react";
import {
  HiArrowUpTray,
  HiCheck,
  HiClipboardDocument,
  HiCodeBracket,
  HiListBullet,
  HiPlus,
  HiSparkles,
  HiTableCells,
  HiTrash,
  HiXMark,
} from "react-icons/hi2";
import Button from "../../ui/Button";
import { SAMPLE_JSON, SAMPLE_ROWS, copyText, excelColumns } from "./quizQuestions";

// Test (Quiz) savollarini qo'lda yozish / Excel / JSON import qilish —
// `SendQuizDialog.jsx` (guruh ichida yuborish) va `QuizTemplateDialog.jsx`
// (shablon yaratish) bitta UI'ni qayta ishlatadi, faqat import chaqiruvi
// (`importFile`/`importJson` props) farq qiladi — guruh-doirali testda
// `/quiz/:groupId/import`, shablonda proxy guruh orqali bir xil endpoint.
// Konstanta/sof funksiyalar `quizQuestions.js`da (react-refresh qoidasi).

/**
 * Savollar muharriri (Savollar / Excel / JSON tablari).
 *
 * @param {Object} props
 * @param {Function} props.t
 * @param {Array} props.questions
 * @param {(key: string, patch: Object) => void} props.onUpdateQuestion
 * @param {() => void} props.onAddQuestion
 * @param {(key: string) => void} props.onRemoveQuestion
 * @param {(key: string) => void} props.onAddOption
 * @param {(key: string, optId: string) => void} props.onRemoveOption
 * @param {string} props.activeTab
 * @param {(tab: string) => void} props.setActiveTab
 * @param {string} props.jsonDraft
 * @param {(v: string) => void} props.setJsonDraft
 * @param {boolean} props.importing
 * @param {(file: File) => Promise<void>} props.onImportFile
 * @param {() => Promise<void>} props.onImportJson
 * @param {boolean} [props.disableImportTabs] - Excel/JSON tablarini butunlay
 * o'chiradi (masalan shablon dialogida proxy guruh topilmaganda — import
 * endpoint guruh egaligini tekshiradi, guruhsiz o'qituvchida ishlamaydi).
 */
function QuestionsEditor({
  t,
  questions,
  onUpdateQuestion,
  onAddQuestion,
  onRemoveQuestion,
  onAddOption,
  onRemoveOption,
  activeTab,
  setActiveTab,
  jsonDraft,
  setJsonDraft,
  importing,
  onImportFile,
  onImportJson,
  disableImportTabs = false,
}) {
  const fileRef = useRef(null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-night-800/70">
        <TabButton
          active={activeTab === "manual"}
          onClick={() => setActiveTab("manual")}
          icon={<HiListBullet className="text-base" />}
          label={t("quiz.send.questions")}
          badge={questions.length}
        />
        <TabButton
          active={activeTab === "excel"}
          onClick={() => setActiveTab("excel")}
          disabled={disableImportTabs}
          icon={<HiTableCells className="text-base" />}
          label={t("quiz.send.fromExcel")}
        />
        <TabButton
          active={activeTab === "json"}
          onClick={() => setActiveTab("json")}
          disabled={disableImportTabs}
          icon={<HiSparkles className="text-base" />}
          label={t("quiz.send.fromJson")}
        />
      </div>

      {activeTab === "manual" && (
        <div className="flex flex-col gap-3">
          {questions.map((q, index) => (
            <QuestionCard
              key={q.key}
              t={t}
              index={index}
              question={q}
              canRemove={questions.length > 1}
              onChange={(patch) => onUpdateQuestion(q.key, patch)}
              onAddOption={() => onAddOption(q.key)}
              onRemoveOption={(optId) => onRemoveOption(q.key, optId)}
              onRemove={() => onRemoveQuestion(q.key)}
            />
          ))}

          <button
            type="button"
            onClick={onAddQuestion}
            className="flex items-center justify-center gap-1.5 h-11 rounded-2xl border border-dashed border-slate-300 dark:border-night-600 text-[13px] font-semibold text-slate-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-600 dark:hover:border-blue-500/60 dark:hover:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-500/5 cursor-pointer transition-colors"
          >
            <HiPlus className="text-base" />
            {t("quiz.send.addQuestion")}
          </button>
        </div>
      )}

      {activeTab === "excel" && (
        <ImportPanel>
          <p className="text-[13px] text-slate-600 dark:text-slate-300">{t("quiz.send.excelHint")}</p>
          <ExcelGuide t={t} />
          <div className="flex items-center gap-2 flex-wrap">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImportFile(file).finally(() => fileRef.current && (fileRef.current.value = ""));
              }}
            />
            <Button className="gap-1.5" loading={importing} onClick={() => fileRef.current?.click()}>
              <HiArrowUpTray className="text-base" />
              {t("quiz.send.importExcel")}
            </Button>
            <Button
              variant="outlined"
              color="slate"
              className="gap-1.5"
              onClick={() => copyText([excelColumns(t), ...SAMPLE_ROWS].map((row) => row.join("\t")).join("\n"))}
            >
              <HiClipboardDocument className="text-base" />
              {t("quiz.send.copySample")}
            </Button>
          </div>
        </ImportPanel>
      )}

      {activeTab === "json" && (
        <ImportPanel>
          <p className="text-[13px] text-slate-600 dark:text-slate-300">{t("quiz.send.jsonHint")}</p>
          <JsonGuide t={t} />
          <Button
            variant="outlined"
            color="violet"
            className="gap-1.5 self-start"
            onClick={() => copyText(`${t("quiz.send.aiPrompt")}\n\n${SAMPLE_JSON}`)}
          >
            <HiSparkles className="text-base" />
            {t("quiz.send.copyAiPrompt")}
          </Button>
          <textarea
            rows={4}
            value={jsonDraft}
            onChange={(e) => setJsonDraft(e.target.value)}
            placeholder={t("quiz.send.importJsonPlaceholder")}
            spellCheck={false}
            className="w-full resize-y rounded-xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 px-3 py-2 font-mono text-xs leading-relaxed text-slate-900 dark:text-slate-100 outline-none placeholder:font-sans placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:ring-3 ring-blue-500/15 duration-200"
          />
          <Button className="gap-1.5 self-start" disabled={!jsonDraft.trim()} loading={importing} onClick={onImportJson}>
            <HiCodeBracket className="text-base" />
            {t("quiz.send.importJsonSubmit")}
          </Button>
        </ImportPanel>
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon, label, badge, disabled = false }) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-disabled={disabled}
      className={`flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-xl text-[13px] font-semibold transition-colors ${
        disabled
          ? "text-slate-300 dark:text-slate-600 cursor-not-allowed"
          : active
            ? "bg-white dark:bg-night-900 text-blue-600 dark:text-blue-400 shadow-[0_1px_2px_rgba(15,23,42,0.08)] cursor-pointer"
            : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
      }`}
    >
      {icon}
      {label}
      {badge > 0 && (
        <span
          className={`inline-flex items-center justify-center min-w-4.5 h-4.5 px-1 rounded-full text-[11px] font-bold tabular-nums ${
            active ? "bg-blue-500 text-white" : "bg-slate-300 dark:bg-night-600 text-white dark:text-slate-200"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function ImportPanel({ children }) {
  return (
    <div className="flex flex-col gap-3 p-3.5 rounded-2xl border border-blue-200/70 dark:border-blue-500/20 bg-blue-50/40 dark:bg-blue-500/5">
      {children}
    </div>
  );
}

// Excel varag'i ko'rinishidagi namuna: ustun harflari, qator raqamlari,
// sarlavha qatori va "to'g'ri javob" ustuni ajratib ko'rsatilgan.
function ExcelGuide({ t }) {
  const cols = excelColumns(t);
  const letters = ["A", "B", "C", "D", "E", "F"];
  const cell = "px-2.5 py-1.5 border-r border-b border-slate-200 dark:border-night-700 whitespace-nowrap";
  const rail =
    "bg-slate-100 dark:bg-night-800 text-[10px] font-semibold text-slate-400 dark:text-slate-500 text-center";
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr>
            <th className={`${cell} ${rail} w-8`} />
            {letters.map((l, i) => (
              <th key={l} className={`${cell} ${rail} ${i === 5 ? "border-r-0" : ""}`}>
                {l}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={`${cell} ${rail}`}>1</td>
            {cols.map((c, i) => (
              <td
                key={c}
                className={`${cell} font-bold ${i === 5 ? "border-r-0 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-slate-50 dark:bg-night-800/60 text-slate-700 dark:text-slate-200"}`}
              >
                {c}
              </td>
            ))}
          </tr>
          {SAMPLE_ROWS.map((row, ri) => (
            <tr key={row[0]}>
              <td className={`${cell} ${rail} ${ri === SAMPLE_ROWS.length - 1 ? "border-b-0" : ""}`}>{ri + 2}</td>
              {row.map((v, i) => (
                <td
                  key={i}
                  className={`${cell} ${ri === SAMPLE_ROWS.length - 1 ? "border-b-0" : ""} ${
                    i === 5
                      ? "border-r-0 bg-emerald-50/60 dark:bg-emerald-500/5 text-center font-bold text-emerald-700 dark:text-emerald-400"
                      : "text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// JSON namunasi — kod bloki ko'rinishida, burchagida nusxalash tugmasi.
function JsonGuide({ t }) {
  return (
    <div className="relative rounded-xl bg-slate-900 dark:bg-night-950 border border-slate-800 dark:border-night-700 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 h-9 border-b border-white/10">
        <span className="text-[11px] font-semibold tracking-wide text-slate-400">JSON</span>
        <button
          type="button"
          onClick={() => copyText(SAMPLE_JSON)}
          className="inline-flex items-center gap-1 px-2 h-6 rounded-md text-[11px] font-semibold text-slate-300 hover:bg-white/10 cursor-pointer transition-colors"
        >
          <HiClipboardDocument className="text-sm" />
          {t("common.copy")}
        </button>
      </div>
      <pre className="overflow-x-auto px-3 py-2.5 font-mono text-[12px] leading-relaxed text-slate-200">
        {SAMPLE_JSON.split("\n").map((line, i) => (
          <JsonLine key={i} line={line} />
        ))}
      </pre>
    </div>
  );
}

// Yengil sintaksis bo'yog'i: kalitlar ko'k, qiymat satrlari yashil.
function JsonLine({ line }) {
  const m = line.match(/^(\s*)"(\w+)":\s(.*)$/);
  if (!m) return <div>{line || " "}</div>;
  return (
    <div>
      {m[1]}
      <span className="text-sky-300">"{m[2]}"</span>: <span className="text-emerald-300">{m[3]}</span>
    </div>
  );
}

function QuestionCard({ t, index, question, canRemove, onChange, onAddOption, onRemoveOption, onRemove }) {
  const field =
    "rounded-xl border bg-white dark:bg-night-900 text-sm text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-3 duration-200";
  return (
    <div className="flex flex-col gap-3 p-3.5 rounded-2xl border border-slate-200 dark:border-night-700 bg-slate-50/70 dark:bg-night-800/40">
      <div className="flex items-center gap-2">
        <span className="shrink-0 grid place-items-center size-7 rounded-lg bg-blue-500 text-white text-xs font-bold tabular-nums">
          {index + 1}
        </span>
        <span className="flex-1 text-[13px] font-semibold text-slate-500 dark:text-slate-400">
          {t("quiz.send.question")}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            title={t("common.delete")}
            className="grid place-items-center shrink-0 size-8 rounded-full text-slate-400 dark:text-slate-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 cursor-pointer transition-colors"
          >
            <HiTrash className="text-base" />
          </button>
        )}
      </div>

      <textarea
        rows={2}
        value={question.text}
        onChange={(e) => onChange({ text: e.target.value })}
        placeholder={t("quiz.send.questionPlaceholder")}
        className={`${field} w-full resize-y px-3 py-2 border-slate-200 dark:border-night-700 focus:border-blue-500 ring-blue-500/15`}
      />

      <div className="flex flex-col gap-2">
        {question.options.map((o) => {
          const correct = question.correctOptionId === o.id;
          return (
            <div key={o.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onChange({ correctOptionId: o.id })}
                title={t("quiz.send.markCorrect")}
                className={`grid place-items-center shrink-0 size-9 rounded-xl border text-[12px] font-bold uppercase transition-colors cursor-pointer ${
                  correct
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 text-slate-500 dark:text-slate-400 hover:border-emerald-400 hover:text-emerald-600"
                }`}
              >
                {correct ? <HiCheck className="text-base" /> : o.id}
              </button>
              <input
                value={o.text}
                onChange={(e) =>
                  onChange({
                    options: question.options.map((opt) => (opt.id === o.id ? { ...opt, text: e.target.value } : opt)),
                  })
                }
                placeholder={`${t("quiz.send.optionPlaceholder")} ${o.id.toUpperCase()}`}
                className={`${field} flex-1 min-w-0 h-9 px-3 ${
                  correct
                    ? "border-emerald-400 dark:border-emerald-500/50 focus:border-emerald-500 ring-emerald-500/15"
                    : "border-slate-200 dark:border-night-700 focus:border-blue-500 ring-blue-500/15"
                }`}
              />
              {question.options.length > 2 && (
                <button
                  type="button"
                  onClick={() => onRemoveOption(o.id)}
                  title={t("common.delete")}
                  className="grid place-items-center shrink-0 size-8 rounded-full text-slate-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer transition-colors"
                >
                  <HiXMark className="text-base" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-400 dark:text-slate-500">
          <span className="grid place-items-center size-4 rounded-md bg-emerald-500 text-white">
            <HiCheck className="text-[10px]" />
          </span>
          {t("quiz.send.correctHint")}
        </span>
        {question.options.length < 6 && (
          <button
            type="button"
            onClick={onAddOption}
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          >
            <HiPlus className="text-sm" />
            {t("quiz.send.addOption")}
          </button>
        )}
      </div>
    </div>
  );
}

export default QuestionsEditor;
