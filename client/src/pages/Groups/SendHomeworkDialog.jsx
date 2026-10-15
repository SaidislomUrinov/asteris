import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiArrowDownTray, HiChevronUp } from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Button from "../../ui/Button";
import MonthNav from "../../ui/MonthNav";
import HomeworkSyllabusPicker from "./HomeworkSyllabusPicker";
import { useHomeworkMonth } from "./useHomeworkMonth";
import { dayCodeOf, daysOfMonth, formatHomeworkDate, monthOf, yearOf } from "./homeworkResults";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";

const MAX_LENGTH = 2000;

/**
 * "Vazifa yuborish" modali: tepada oyning kunlari X o'qi bo'yicha (default —
 * bugun), pastda shu kun vazifasi. Vazifa qo'lda yoziladi yoki kurs
 * dasturidan import qilinadi. Mavjud vazifa tanlansa — tahrirlanadi/o'chiriladi.
 *
 * Saqlash: `PUT /homework/:groupId/:date` (bo'sh matn → o'chirish).
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} props.groupId
 * @param {string} props.initialDate - "YYYY-MM-DD"
 * @param {Object} [props.lessonByDate]
 * @param {(date: Date) => void} [props.extendTo]
 * @param {boolean} [props.canImport] - `lesson:view` + `lesson.planning`
 * @param {(date: string, item: Object|null) => void} [props.onSaved]
 */
function SendHomeworkDialog({ open, onClose, groupId, initialDate, lessonByDate = {}, extendTo, canImport, onSaved }) {
  const { t } = useTranslation();
  const [date, setDate] = useState(initialDate);
  const month = date.slice(0, 7);
  const { items, setItems, lessonDays, today } = useHomeworkMonth({ groupId, month, lessonByDate, enabled: open });

  const base = items[date]?.text || "";
  const [draft, setDraft] = useState(base);
  const [syncKey, setSyncKey] = useState(`${date}|${base}`);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const stripRef = useRef(null);

  // Kun almashsa yoki vazifa yuklansa — qoralama shu kun matniga o'tadi.
  if (`${date}|${base}` !== syncKey) {
    setSyncKey(`${date}|${base}`);
    setDraft(base);
    setConfirmDelete(false);
  }

  // Kelgusi oy ochilsa — useLessonSchedule o'sha oy oxirigacha hisoblasin.
  useEffect(() => {
    if (open) extendTo?.(new Date(yearOf(month), monthOf(month) + 1, 0));
  }, [open, month, extendTo]);

  // Tanlangan kun tasmada markazda tursin.
  useEffect(() => {
    const el = stripRef.current?.querySelector(`[data-date="${date}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [date, open]);

  const changeMonth = (m) => {
    const days = daysOfMonth(m);
    setDate(today.startsWith(m) ? today : days[0]);
  };

  const save = async (text) => {
    if (saving) return;
    try {
      setSaving(true);
      const res = await api.put(`/homework/${groupId}/${date}`, { text });
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      const item = text ? (data?.date ? data : { ...items[date], date, text }) : null;
      setItems((prev) => {
        const next = { ...prev };
        if (item) next[date] = item;
        else delete next[date];
        return next;
      });
      onSaved?.(date, item);
      successMsg(msg || (text ? "homework.saved" : "homework.deleted"));
      onClose();
    } catch (err) {
      errorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const text = draft.trim();
  const dirty = text !== base.trim();
  const monthNames = t("common.monthNames", { returnObjects: true });
  const suggestedId = lessonByDate[date]?._id;

  return (
    <Dialog
      open={open}
      onClose={() => !saving && onClose()}
      title={t("homework.send.title")}
      widthClass="md:w-150"
      actions={
        <>
          {base && (
            <div className="mr-auto">
              <Button
                variant="text"
                color="red"
                disabled={saving}
                onClick={() => (confirmDelete ? save("") : setConfirmDelete(true))}
              >
                {t(confirmDelete ? "homework.send.confirmDelete" : "common.delete")}
              </Button>
            </div>
          )}
          <Button color="black" variant="text" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button loading={saving} disabled={!text || !dirty} onClick={() => save(text)}>
            {t(base ? "common.save" : "homework.send.submit")}
          </Button>
        </>
      }
    >
      {/* Oy + kunlar tasmasi */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <MonthNav
            month={month}
            label={`${monthNames[monthOf(month)]} ${yearOf(month)}`}
            onChange={changeMonth}
          />
          {date !== today && (
            <button
              type="button"
              onClick={() => setDate(today)}
              className="px-2.5 h-7 rounded-full text-[12px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 cursor-pointer transition-colors"
            >
              {t("homework.today")}
            </button>
          )}
        </div>
        <div ref={stripRef} className="flex items-center gap-1.5 overflow-x-auto pb-1.5 -mx-6 px-6 scroll-px-6">
          {daysOfMonth(month).map((d) => {
            const active = d === date;
            const isToday = d === today;
            const lesson = lessonDays.has(d);
            const has = !!items[d];
            return (
              <button
                key={d}
                type="button"
                data-date={d}
                onClick={() => setDate(d)}
                className={`flex flex-col items-center justify-center gap-0.5 shrink-0 w-12 h-15 rounded-2xl border text-center cursor-pointer transition-colors duration-150 ${
                  active
                    ? "bg-blue-500 border-blue-500 text-white shadow-[0_4px_12px_-4px_rgba(59,130,246,0.6)]"
                    : isToday
                      ? "bg-blue-50 dark:bg-blue-500/15 border-blue-300 dark:border-blue-500/40 text-blue-700 dark:text-blue-400"
                      : lesson
                        ? "bg-white dark:bg-night-900 border-slate-300 dark:border-night-600 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-night-800"
                        : "bg-slate-50/60 dark:bg-night-800/40 border-transparent text-slate-300 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-night-800"
                }`}
              >
                <span className={`text-[10px] font-semibold uppercase leading-tight ${active ? "text-white/80" : ""}`}>
                  {t(`group.dayShort.${dayCodeOf(d)}`)}
                </span>
                <span className="text-sm font-bold tabular-nums leading-tight">{Number(d.slice(8, 10))}</span>
                <span
                  className={`size-1.5 rounded-full ${
                    has
                      ? active
                        ? "bg-white"
                        : "bg-sky-500"
                      : lesson
                        ? active
                          ? "ring-1 ring-inset ring-white/70"
                          : "ring-1 ring-inset ring-slate-400 dark:ring-slate-500"
                        : ""
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Vazifa matni */}
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{formatHomeworkDate(t, date)}</span>
        <textarea
          rows={5}
          value={draft}
          maxLength={MAX_LENGTH}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && text && dirty) {
              e.preventDefault();
              save(text);
            }
          }}
          placeholder={t("homework.placeholder")}
          className="w-full resize-y min-h-28 rounded-xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 px-3.5 py-2.5 text-sm leading-relaxed text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 hover:border-slate-300 dark:hover:border-night-600 focus:border-blue-500 focus:ring-3 ring-blue-500/15 duration-200"
        />
        <div className="flex items-center gap-2">
          {canImport && (
            <button
              type="button"
              onClick={() => setImportOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full border border-dashed border-blue-200 dark:border-blue-500/30 bg-blue-50/60 dark:bg-blue-500/10 text-[12px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/15 cursor-pointer transition-colors"
            >
              {importOpen ? <HiChevronUp className="text-sm" /> : <HiArrowDownTray className="text-sm" />}
              {t("homework.send.import")}
            </button>
          )}
          {draft.length >= MAX_LENGTH - 200 && (
            <span className="ml-auto text-[11px] tabular-nums text-amber-600 dark:text-amber-400">
              {draft.length}/{MAX_LENGTH}
            </span>
          )}
        </div>
        {canImport && importOpen && (
          <HomeworkSyllabusPicker
            groupId={groupId}
            suggestedId={suggestedId}
            onPick={(hw) => {
              setDraft(hw);
              setImportOpen(false);
            }}
          />
        )}
      </div>
    </Dialog>
  );
}

export default SendHomeworkDialog;
