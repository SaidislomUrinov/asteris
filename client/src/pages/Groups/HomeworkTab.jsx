import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  HiCheckCircle,
  HiOutlineClipboardDocumentList,
  HiPaperAirplane,
  HiPencilSquare,
  HiTrash,
} from "react-icons/hi2";
import MonthNav from "../../ui/MonthNav";
import Button from "../../ui/Button";
import RowNumber from "../../ui/RowNumber";
import RankMedal from "../../ui/RankMedal";
import StudentPhotoAvatar from "../../ui/StudentPhotoAvatar";
import HomeworkResultCell from "./HomeworkResultCell";
import SendHomeworkDialog from "./SendHomeworkDialog";
import MatrixSkeleton from "./MatrixSkeleton";
import { useHomeworkMonth } from "./useHomeworkMonth";
import { RESULT_BY_KEY, RESULT_OPTIONS, dayCodeOf, formatHomeworkDate, monthOf, tashkentToday, yearOf } from "./homeworkResults";
import { api } from "../../utils/fetching";
import { errorMsg } from "../../utils/alert";

// "24.09 14:30" — server `getNow()` SONIYA, eski yozuvlarda ms bo'lishi mumkin.
const pad = (n) => String(n).padStart(2, "0");
const formatStamp = (ts) => {
  if (!ts) return "";
  const d = new Date(ts < 1e12 ? ts * 1000 : ts);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * "Uyga vazifa" tabi — GroupDetail (`/groups/:id`) va `/lesson` uchun YAGONA.
 *
 * Oylik davomat kabi o'quvchi × vazifa-kuni matritsasi: ustunlar faqat shu oyda
 * VAZIFA YUBORILGAN kunlar, kataklar dumaloq (Bajardi / Chala / Bajarmadi).
 * Vazifa matnlari birdaniga chiqmaydi — ustun sarlavhasi bosilganda ko'rinadi.
 * Yangi vazifa "Vazifa yuborish" modali orqali (SendHomeworkDialog).
 *
 * @param {Object} props
 * @param {string} props.groupId
 * @param {boolean} props.canWrite - `attendance:create` + guruh faol
 * @param {boolean} [props.canImport] - kurs dasturidan import (`lesson:view` + `lesson.planning`)
 * @param {Object} [props.lessonByDate]
 * @param {(date: Date) => void} [props.extendTo]
 * @param {Array} [props.students] - faol a'zolar (GroupDetail tartibida)
 * @param {Object} [props.ranks]
 * @param {(studentId: string, photo: string) => void} [props.onPhotoUpdated]
 */
function HomeworkTab({ groupId, canWrite, canImport, lessonByDate = {}, extendTo, students = [], ranks = {}, onPhotoUpdated }) {
  const { t } = useTranslation();
  const [month, setMonth] = useState(() => tashkentToday().slice(0, 7));
  const { items, setItems, loading, error, refetch, today } = useHomeworkMonth({ groupId, month, lessonByDate });
  const [selectedDate, setSelectedDate] = useState("");
  const [picker, setPicker] = useState(null); // { studentId, date, x, y }
  const [dayMenu, setDayMenu] = useState(null); // { date, x, y }
  const [sendDate, setSendDate] = useState(null); // modal ochiq bo'lsa — boshlang'ich sana
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);
  const dateScrollRef = useRef(null);

  // Kelgusi oy ochilsa — useLessonSchedule o'sha oy oxirigacha hisoblasin.
  useEffect(() => {
    extendTo?.(new Date(yearOf(month), monthOf(month) + 1, 0));
  }, [month, extendTo]);

  const dates = useMemo(() => Object.keys(items).sort(), [items]);

  // Tanlangan kun: bugun yoki undan oldingi eng so'nggi vazifa kuni.
  const activeDate = dates.includes(selectedDate)
    ? selectedDate
    : [...dates].reverse().find((d) => d <= today) || dates[0] || "";

  // Yangi oy yuklanganda oxirgi ustunlar ko'rinib tursin.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && !loading) el.scrollLeft = el.scrollWidth;
  }, [month, loading]);

  useEffect(() => {
    const pill = dateScrollRef.current?.querySelector(`[data-date="${activeDate}"]`);
    pill?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [activeDate, loading]);

  const saveResults = useCallback(
    async (date, list) => {
      try {
        setBusy(true);
        const res = await api.put(`/homework/${groupId}/${date}/results`, { results: list });
        const { ok, data, msg } = res.data;
        if (!ok) throw new Error(msg);
        setItems((prev) => (prev[date] ? { ...prev, [date]: { ...prev[date], results: data?.results || {} } } : prev));
        return true;
      } catch (err) {
        errorMsg(err.message);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [groupId, setItems],
  );

  const mark = async (status) => {
    const { studentId, date } = picker;
    const current = items[date]?.results?.[studentId] || null;
    if (await saveResults(date, [{ student: studentId, status: current === status ? null : status }])) setPicker(null);
  };

  const unmarkedOf = (date) => students.filter((s) => !items[date]?.results?.[s._id]);
  const markAllDone = async (date) => {
    const targets = unmarkedOf(date);
    if (!targets.length) return;
    if (await saveResults(date, targets.map((s) => ({ student: s._id, status: "done" })))) setDayMenu(null);
  };

  const countsOf = (date) => {
    const results = items[date]?.results || {};
    const counts = { done: 0, partial: 0, missed: 0, unmarked: 0 };
    for (const s of students) counts[results[s._id] || "unmarked"] += 1;
    return counts;
  };

  // O'quvchi bo'yicha oylik bajarilish: chala — yarim ball.
  const rateOf = (studentId) => {
    let marked = 0;
    let score = 0;
    for (const d of dates) {
      const r = items[d]?.results?.[studentId];
      if (!r) continue;
      marked += 1;
      score += r === "done" ? 1 : r === "partial" ? 0.5 : 0;
    }
    return marked ? Math.round((score / marked) * 100) : null;
  };

  const openPicker = (e, studentId, date) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPicker({ studentId, date, x: r.left + r.width / 2, y: r.bottom + 6 });
  };

  const openDayMenu = (e, date) => {
    setSelectedDate(date);
    const r = e.currentTarget.getBoundingClientRect();
    setDayMenu({ date, x: r.left + r.width / 2, y: r.bottom + 6 });
  };

  const titleFor = (date, status) =>
    `${formatHomeworkDate(t, date)} · ${status ? t(`homework.results.${status}`) : t("homework.results.unmarked")}`;

  const monthNames = t("common.monthNames", { returnObjects: true });
  const label = `${monthNames[monthOf(month)]} ${yearOf(month)}`;
  const activeItem = items[activeDate];
  const activeCounts = activeDate ? countsOf(activeDate) : null;
  const canMarkActive = canWrite && !!activeDate && activeDate <= today;

  return (
    <div className="flex flex-col flex-1 gap-3">
      {/* Sarlavha: oy, izoh, yuborish */}
      <div className="flex items-center justify-between gap-2">
        <MonthNav month={month} label={label} onChange={setMonth} />
        <div className="flex items-center gap-3 ml-auto shrink-0">
          <Legend t={t} className="hidden md:flex" />
          {canWrite && (
            <Button className="gap-1.5 max-sm:!px-3" onClick={() => setSendDate(today)}>
              <HiPaperAirplane className="text-base shrink-0 -rotate-45" />
              {t("homework.send.button")}
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <MatrixSkeleton rows={students.length || 6} rowHeight={52} />
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-slate-400 dark:text-slate-500">
          {t("common.error")}
          <Button variant="outlined" color="slate" onClick={refetch}>
            {t("common.retry")}
          </Button>
        </div>
      ) : dates.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-12 text-center rounded-2xl border border-dashed border-slate-200 dark:border-night-700">
          <span className="grid place-items-center size-16 rounded-full bg-sky-500/10 ring-8 ring-sky-500/5 text-sky-500 dark:text-sky-400">
            <HiOutlineClipboardDocumentList className="text-3xl" />
          </span>
          <p className="text-[15px] font-semibold text-slate-700 dark:text-slate-200">{t("homework.matrix.empty")}</p>
          {canWrite && (
            <Button className="gap-1.5" onClick={() => setSendDate(today)}>
              <HiPaperAirplane className="text-base shrink-0 -rotate-45" />
              {t("homework.send.button")}
            </Button>
          )}
        </div>
      ) : students.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-400 dark:text-slate-500">
          {t("homework.results.noStudents")}
        </div>
      ) : (
        <>
          {/* ── Mobil (<768px): kun tanlovi + vazifa + kartalar ── */}
          <div className="flex md:hidden flex-col gap-3">
            <div ref={dateScrollRef} className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-4 px-4">
              {dates.map((d) => {
                const active = d === activeDate;
                const isToday = d === today;
                return (
                  <button
                    key={d}
                    type="button"
                    data-date={d}
                    onClick={() => setSelectedDate(d)}
                    className={`flex flex-col items-center justify-center shrink-0 w-11 h-12 rounded-2xl border text-center transition-colors duration-150 ${
                      active
                        ? "bg-sky-500 border-sky-500 text-white"
                        : isToday
                          ? "bg-sky-50 dark:bg-sky-500/15 border-sky-200 dark:border-sky-500/30 text-sky-700 dark:text-sky-400"
                          : "bg-white dark:bg-night-900 border-slate-200 dark:border-night-700 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    <span className={`text-[10px] font-semibold uppercase leading-tight ${active ? "text-white/80" : ""}`}>
                      {t(`group.dayShort.${dayCodeOf(d)}`)}
                    </span>
                    <span className="text-sm font-bold tabular-nums leading-tight">{Number(d.slice(8, 10))}</span>
                  </button>
                );
              })}
            </div>

            {activeItem && (
              <HomeworkNote
                t={t}
                item={activeItem}
                counts={activeCounts}
                canEdit={canWrite}
                onEdit={() => setSendDate(activeDate)}
                canMarkAll={canMarkActive && activeCounts.unmarked > 0}
                busy={busy}
                onMarkAll={() => markAllDone(activeDate)}
              />
            )}

            <div className="flex flex-col gap-2">
              {students.map((s, index) => {
                const status = activeItem?.results?.[s._id] || null;
                const tone = status ? RESULT_BY_KEY[status] : null;
                const Icon = tone?.icon;
                return (
                  <div
                    key={s._id}
                    className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-night-900 border border-slate-200/70 dark:border-night-700/70"
                  >
                    <RowNumber value={index + 1} />
                    <span className="relative shrink-0">
                      <StudentPhotoAvatar student={s} onUpdated={onPhotoUpdated} size={38} rounded="rounded-full" />
                      <span className="absolute -right-1.5 -bottom-2 flex">
                        <RankMedal position={ranks[s._id]} size={17} />
                      </span>
                    </span>
                    <span className="flex-1 min-w-0 text-[13px] font-semibold text-slate-800 dark:text-slate-100 truncate">
                      {s.fullName}
                    </span>
                    <button
                      type="button"
                      disabled={!canMarkActive}
                      onClick={(e) => openPicker(e, s._id, activeDate)}
                      className={`flex items-center justify-center gap-1.5 shrink-0 h-9 px-3 rounded-full ring-1 ring-inset text-[12px] font-semibold transition-all duration-150 ${
                        tone ? tone.cell : "bg-slate-50 dark:bg-night-800 text-slate-500 dark:text-slate-400 ring-slate-200 dark:ring-night-700"
                      } ${canMarkActive ? "cursor-pointer active:scale-95" : "cursor-default opacity-70"}`}
                    >
                      {Icon && <Icon className="text-base" />}
                      {t(status ? `homework.results.${status}` : "homework.results.unmarked")}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Desktop/planshet (>=768px): matritsa ── */}
          <div
            ref={scrollRef}
            className="hidden md:block w-full isolate overflow-x-auto rounded-xl border border-slate-200 dark:border-night-700"
          >
            <table className="w-max min-w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 w-56 min-w-56 px-3 py-2 bg-slate-50 dark:bg-night-800 border-b border-r border-slate-200 dark:border-night-700 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {t("student.fullName")}
                  </th>
                  {dates.map((d) => {
                    const active = d === activeDate && !!dayMenu;
                    const isToday = d === today;
                    return (
                      <th
                        key={d}
                        title={items[d]?.text}
                        onClick={(e) => openDayMenu(e, d)}
                        className={`w-12 min-w-12 px-1 py-1.5 border-b text-center cursor-pointer transition-colors ${
                          active
                            ? "border-sky-400 bg-sky-100 dark:bg-sky-500/20"
                            : `border-slate-200 dark:border-night-700 ${isToday ? "bg-sky-50/70 dark:bg-sky-500/15" : "bg-slate-50 dark:bg-night-800"} hover:bg-slate-100 dark:hover:bg-night-700`
                        }`}
                      >
                        <span
                          className={`block text-[10px] font-semibold uppercase leading-tight ${
                            active || isToday ? "text-sky-600 dark:text-sky-400" : "text-slate-400 dark:text-slate-500"
                          }`}
                        >
                          {t(`group.dayShort.${dayCodeOf(d)}`)}
                        </span>
                        <span
                          className={`block text-[13px] font-semibold tabular-nums leading-tight ${
                            active || isToday
                              ? "text-sky-700 dark:text-sky-400"
                              : d > today
                                ? "text-slate-400 dark:text-slate-500"
                                : "text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {Number(d.slice(8, 10))}
                        </span>
                      </th>
                    );
                  })}
                  <th className="sticky right-0 z-20 w-24 min-w-24 px-2 py-2 bg-slate-50 dark:bg-night-800 border-b border-l border-slate-200 dark:border-night-700 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {t("homework.matrix.rate")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, index) => {
                  const rate = rateOf(s._id);
                  return (
                    <tr key={s._id} className="group/row">
                      <td className="sticky left-0 z-10 w-56 min-w-56 px-3 py-2 bg-white dark:bg-night-900 border-b border-r border-slate-100 dark:border-night-700 group-hover/row:bg-slate-50 dark:group-hover/row:bg-night-800 transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <RowNumber value={index + 1} />
                          <StudentPhotoAvatar student={s} onUpdated={onPhotoUpdated} size={32} rounded="rounded-full" />
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 truncate leading-tight">
                              {s.fullName}
                            </span>
                            <RankMedal position={ranks[s._id]} size={19} />
                          </span>
                        </div>
                      </td>
                      {dates.map((d) => {
                        const status = items[d]?.results?.[s._id] || null;
                        const future = d > today;
                        return (
                          <td
                            key={d}
                            className={`w-12 min-w-12 p-1 border-b border-slate-100 dark:border-night-700 text-center align-middle ${
                              d === today ? "bg-sky-50/40 dark:bg-sky-500/10" : ""
                            }`}
                          >
                            <HomeworkResultCell
                              className="mx-auto"
                              status={status}
                              future={future}
                              disabled={!canWrite}
                              title={future ? `${formatHomeworkDate(t, d)} · ${t("homework.resultFuture")}` : titleFor(d, status)}
                              onClick={(e) => openPicker(e, s._id, d)}
                            />
                          </td>
                        );
                      })}
                      <td className="sticky right-0 z-10 w-24 min-w-24 px-2 py-2 bg-white dark:bg-night-900 border-b border-l border-slate-100 dark:border-night-700 group-hover/row:bg-slate-50 dark:group-hover/row:bg-night-800 transition-colors">
                        <RateCell rate={rate} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Natija tanlash menyusi — katak ostida */}
      {picker &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => !busy && setPicker(null)} />
            <div
              style={{
                position: "fixed",
                top: Math.min(picker.y, window.innerHeight - 190),
                left: Math.max(8, Math.min(picker.x - 96, window.innerWidth - 200)),
                zIndex: 50,
              }}
              className="flex flex-col gap-0.5 w-48 p-1 rounded-2xl bg-white dark:bg-night-900 border border-slate-200 dark:border-night-700 shadow-xl dark:shadow-none"
            >
              <span className="px-2 py-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500 tabular-nums">
                {formatHomeworkDate(t, picker.date)}
              </span>
              {RESULT_OPTIONS.map((o) => {
                const current = items[picker.date]?.results?.[picker.studentId] === o.key;
                return (
                  <button
                    key={o.key}
                    type="button"
                    disabled={busy}
                    onClick={() => mark(o.key)}
                    className={`flex items-center gap-2 w-full px-1.5 h-10 rounded-xl text-[13px] font-medium text-left cursor-pointer disabled:opacity-50 transition-colors ${
                      current ? "bg-slate-100 dark:bg-night-800 text-slate-900 dark:text-slate-100" : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-night-800"
                    }`}
                  >
                    <HomeworkResultCell status={o.key} static size="size-7" />
                    {t(`homework.results.${o.key}`)}
                  </button>
                );
              })}
              {items[picker.date]?.results?.[picker.studentId] && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => mark(items[picker.date].results[picker.studentId])}
                  className="flex items-center gap-2 w-full px-1.5 h-9 rounded-xl text-[12px] font-medium text-left whitespace-nowrap text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-night-800 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer transition-colors"
                >
                  <span className="grid place-items-center size-7">
                    <HiTrash className="text-sm" />
                  </span>
                  {t("homework.results.clear")}
                </button>
              )}
            </div>
          </>,
          document.body,
        )}

      {/* Ustun sarlavhasi bosilganda — shu kun vazifasi */}
      {dayMenu &&
        items[dayMenu.date] &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => !busy && setDayMenu(null)} />
            <div
              style={{
                position: "fixed",
                top: Math.min(dayMenu.y, window.innerHeight - 260),
                left: Math.max(8, Math.min(dayMenu.x - 160, window.innerWidth - 336)),
                zIndex: 50,
              }}
              className="w-80 p-1 rounded-2xl bg-white dark:bg-night-900 border border-slate-200 dark:border-night-700 shadow-xl dark:shadow-none"
            >
              <HomeworkNote
                t={t}
                plain
                item={items[dayMenu.date]}
                counts={countsOf(dayMenu.date)}
                canEdit={canWrite}
                onEdit={() => {
                  setSendDate(dayMenu.date);
                  setDayMenu(null);
                }}
                canMarkAll={canWrite && dayMenu.date <= today && countsOf(dayMenu.date).unmarked > 0}
                busy={busy}
                onMarkAll={() => markAllDone(dayMenu.date)}
              />
            </div>
          </>,
          document.body,
        )}

      {canWrite && (
        <SendHomeworkDialog
          key={sendDate || "closed"}
          open={!!sendDate}
          onClose={() => setSendDate(null)}
          groupId={groupId}
          initialDate={sendDate || today}
          lessonByDate={lessonByDate}
          extendTo={extendTo}
          canImport={canImport}
          onSaved={(date, item) => {
            if (!date.startsWith(`${month}-`)) {
              setMonth(date.slice(0, 7));
              return;
            }
            setItems((prev) => {
              const next = { ...prev };
              if (item) next[date] = { ...prev[date], ...item };
              else delete next[date];
              return next;
            });
            if (item) setSelectedDate(date);
          }}
        />
      )}
    </div>
  );
}

// Bir kunning vazifasi: matn, kim/qachon, natijalar xulosasi va amallar.
function HomeworkNote({ t, item, counts, canEdit, onEdit, canMarkAll, busy, onMarkAll, plain = false }) {
  const stamp = [item.updatedBy?.name, formatStamp(item.updatedAt)].filter(Boolean).join(" · ");
  return (
    <div
      className={`flex flex-col gap-2.5 p-3 ${
        plain ? "" : "rounded-2xl border border-sky-100 dark:border-sky-500/20 bg-sky-50/40 dark:bg-sky-500/5"
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[13px] font-semibold text-sky-700 dark:text-sky-400">
            {formatHomeworkDate(t, item.date)}
          </span>
          {stamp && <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{stamp}</span>}
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={onEdit}
            title={t("homework.results.edit")}
            className="grid place-items-center shrink-0 size-8 rounded-full text-slate-400 dark:text-slate-500 hover:bg-white dark:hover:bg-night-800 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer transition-colors"
          >
            <HiPencilSquare className="text-base" />
          </button>
        )}
      </div>
      <p className="max-h-40 overflow-y-auto text-[13px] leading-relaxed whitespace-pre-wrap break-words text-slate-800 dark:text-slate-100">
        {item.text}
      </p>
      <div className="flex items-center gap-2.5 flex-wrap">
        {RESULT_OPTIONS.map((o) => (
          <span key={o.key} className={`inline-flex items-center gap-1 text-[12px] font-semibold tabular-nums ${o.text}`}>
            <o.icon className="text-sm" />
            {counts[o.key]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1 text-[12px] font-semibold tabular-nums text-slate-400 dark:text-slate-500">
          <span className="size-1.5 rounded-full bg-slate-300 dark:bg-night-600" />
          {counts.unmarked}
        </span>
        {canMarkAll && (
          <div className="ml-auto">
            <Button variant="ghost" color="blue" className="!h-8 !min-h-0 !px-2.5 !text-[12px]" loading={busy} onClick={onMarkAll}>
              <HiCheckCircle className="text-base shrink-0" />
              {t("homework.results.markAllDone")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Legend({ t, className = "" }) {
  return (
    <div className={`items-center gap-x-3 text-[11px] text-slate-400 dark:text-slate-500 ${className}`}>
      {RESULT_OPTIONS.map((o) => (
        <span key={o.key} className="flex items-center gap-1.5">
          <span className={`size-2 rounded-full ${o.dot}`} />
          {t(`homework.results.${o.key}`)}
        </span>
      ))}
    </div>
  );
}

// Oylik bajarilish foizi (chala — yarim ball); belgilanmagan bo'lsa "—".
function RateCell({ rate }) {
  if (rate === null) return <span className="block text-center text-[13px] text-slate-300 dark:text-slate-600">—</span>;
  const tone = rate >= 80 ? "text-sky-600 dark:text-sky-400" : rate >= 50 ? "text-orange-600 dark:text-orange-400" : "text-rose-600 dark:text-rose-400";
  const bar = rate >= 80 ? "bg-sky-500" : rate >= 50 ? "bg-orange-500" : "bg-rose-500";
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`text-[13px] font-semibold tabular-nums ${tone}`}>{rate}%</span>
      <span className="w-full h-1 rounded-full bg-slate-100 dark:bg-night-800 overflow-hidden">
        <span className={`block h-full rounded-full ${bar}`} style={{ width: `${rate}%` }} />
      </span>
    </div>
  );
}

export default HomeworkTab;
