import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiArrowDownTray, HiCheck } from "react-icons/hi2";
import Button from "../../ui/Button";

const MAX_LENGTH = 2000;
const COUNTER_FROM = 1800;

const JS_DAY_TO_CODE = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// Server `getNow()` SONIYA qaytaradi, kontrakt misolida esa ms bor — ikkalasini
// ham to'g'ri ko'rsatish uchun kichik qiymat soniya deb olinadi.
const toMs = (ts) => (ts < 1e12 ? ts * 1000 : ts);

const DAY_MONTH = {
  ru: (day, month) => `${day} ${month}`,
  en: (day, month) => `${month} ${day}`,
};

// "24.09 14:30" — loyihadagi 24 soatlik format, locale'dan mustaqil.
const pad = (n) => String(n).padStart(2, "0");
const formatStamp = (ts) => {
  if (!ts) return "";
  const d = new Date(toMs(ts));
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * Bitta dars kuni uchun uyga vazifa kartasi (HomeworkTab ichida).
 *
 * Qoralama (draft) lokal saqlanadi: tashqaridan (socket/refetch) matn
 * o'zgarsa va foydalanuvchi hali tahrir boshlamagan bo'lsa — yangilanadi,
 * tahrir qilinayotgan bo'lsa qoralama ustidan yozilmaydi.
 *
 * @param {Object} props
 * @param {string} props.date - "YYYY-MM-DD"
 * @param {"today"|"tomorrow"|null} [props.badge]
 * @param {boolean} [props.muted] - o'tgan kun — vizual jihatdan xiraroq
 * @param {Object|null} props.item - { text, updatedAt, updatedBy: { name } }
 * @param {string} [props.suggestion] - kurs dasturidagi shu kun `homework`i
 * @param {boolean} props.canWrite - `attendance:create`
 * @param {(date: string, text: string) => Promise<boolean>} props.onSave
 */
function HomeworkDayCard({ date, badge = null, muted = false, item, suggestion = "", canWrite, onSave }) {
  const { t, i18n } = useTranslation();
  const d = new Date(`${date}T00:00:00`);
  const dayNum = d.getDate();
  // "24-sentabr" / "24 сентября" / "September 24". Intl ishlatilmaydi:
  // brauzer ICU'sida o'zbek oy nomlari yo'q ("M09 24" chiqaradi).
  const monthName = t("common.monthsGenitive", { returnObjects: true })[d.getMonth()] || "";
  const dayMonth = DAY_MONTH[i18n.language]?.(dayNum, monthName) ?? `${dayNum}-${monthName}`;
  const weekdayLabel = t(`group.day.${JS_DAY_TO_CODE[d.getDay()]}`);
  const base = item?.text || "";
  const [draft, setDraft] = useState(base);
  const [prevBase, setPrevBase] = useState(base);
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);

  // Tashqi o'zgarish — faqat tahrir qilinmagan qoralamani yangilaymiz.
  if (base !== prevBase) {
    setPrevBase(base);
    if (draft === prevBase) setDraft(base);
  }

  // Auto-grow: balandlik kontentga moslashadi.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [draft]);

  const dirty = draft.trim() !== base.trim();

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    const ok = await onSave(date, draft.trim());
    setSaving(false);
    if (ok) setDraft(draft.trim());
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      save();
    }
  };

  // Faqat bo'sh maydonda — mavjud matn ustiga taklif qilinmaydi.
  const showSuggestion = canWrite && !!suggestion && !draft.trim();
  const stamp = item?.updatedAt
    ? [item.updatedBy?.name, formatStamp(item.updatedAt)].filter(Boolean).join(" · ")
    : "";

  return (
    <div
      data-date={date}
      className={`flex flex-col gap-2.5 p-3 rounded-xl border bg-white transition-colors ${
        badge === "today" ? "border-blue-200 ring-1 ring-blue-100" : muted ? "border-slate-100" : "border-slate-200"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div
          className={`flex flex-col items-center justify-center shrink-0 w-11 h-11 rounded-xl leading-tight ${
            badge === "today"
              ? "bg-blue-500 text-white"
              : badge === "tomorrow"
                ? "bg-blue-50 text-blue-600"
                : muted
                  ? "bg-slate-50 text-slate-400"
                  : "bg-slate-100 text-slate-600"
          }`}
        >
          <span className="text-[9px] font-semibold uppercase opacity-80">
            {t(`group.dayShort.${JS_DAY_TO_CODE[d.getDay()]}`)}
          </span>
          <span className="text-sm font-bold tabular-nums">{dayNum}</span>
        </div>

        <div className="flex flex-col min-w-0 leading-tight">
          <span className={`text-[13px] font-semibold truncate ${muted ? "text-slate-500" : "text-slate-800"}`}>
            {weekdayLabel}, {dayMonth}
          </span>
          {badge ? (
            <span className={`text-[11px] font-semibold ${badge === "today" ? "text-blue-600" : "text-slate-400"}`}>
              {t(`homework.${badge}`)}
            </span>
          ) : (
            stamp && <span className="text-[11px] text-slate-400 truncate">{stamp}</span>
          )}
        </div>

        {base && !dirty && (
          <HiCheck className="ml-auto shrink-0 text-emerald-500 text-base" title={t("homework.saved")} />
        )}
      </div>

      {canWrite ? (
        <textarea
          ref={ref}
          rows={2}
          value={draft}
          maxLength={MAX_LENGTH}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={suggestion || t("homework.placeholder")}
          className="w-full resize-none overflow-hidden rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] leading-relaxed text-slate-900 outline-none placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-3 ring-blue-500/15 duration-200"
        />
      ) : (
        <p
          className={`text-[13px] leading-relaxed whitespace-pre-wrap break-words ${
            base ? (muted ? "text-slate-600" : "text-slate-800") : "text-slate-400"
          }`}
        >
          {base || t("homework.noHomework")}
        </p>
      )}

      {(showSuggestion || (canWrite && dirty) || (canWrite && draft.length >= COUNTER_FROM)) && (
        <div className="flex items-center gap-2 flex-wrap">
          {canWrite && draft.length >= COUNTER_FROM && (
            <span className="text-[11px] text-amber-600">
              {draft.length}/{MAX_LENGTH}
            </span>
          )}
          <div className="flex items-center gap-2 ml-auto">
            {showSuggestion && (
              <button
                type="button"
                onClick={() => setDraft(suggestion)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-dashed border-blue-200 bg-blue-50/60 text-[12px] font-medium text-blue-600 hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-colors"
              >
                <HiArrowDownTray className="text-sm shrink-0" />
                {t("homework.fromSyllabus")}
              </button>
            )}
            {canWrite && dirty && (
              <Button className="px-4" loading={saving} onClick={save} title={t("homework.saveHint")}>
                {t("common.save")}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default HomeworkDayCard;
