import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import { HiChevronLeft, HiChevronRight, HiTrash } from "react-icons/hi2";
import Avatar from "../../ui/Avatar";
import RowNumber from "../../ui/RowNumber";
import RankMedal from "../../ui/RankMedal";
import MatrixSkeleton from "./MatrixSkeleton";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { api } from "../../utils/fetching";
import { errorMsg } from "../../utils/alert";

// `transferred` kun — shu guruhda dars bo'lmagan, faqat oldingi guruh
// (o'tkazilgan o'quvchi) bahosini ko'rsatish uchun qo'shilgan ustun.
const dayLocked = (d) => d.future || !!d.holiday || !!d.transferred;

// 10 ballik shkala (API_CONTRACT_grade_scale10.md §3) — tanlovda ikki qator: 10..6, 5..1.
const VALUE_ROWS = [
  [10, 9, 8, 7, 6],
  [5, 4, 3, 2, 1],
];

// Baho rangi — 9–10 yashil, 7–8 ko'k, 5–6 sariq, 3–4 to'q sariq, 1–2 qizil.
// Ko'rinish davomat kataklari (`AttendanceCheckbox`) bilan bir xil: to'q
// to'ldirish emas, yumshoq `color/12` fon + to'q raqam + ichki `ring`.
const TONE_BY_BAND = [
  "bg-red-500/12 text-red-500 ring-red-500/30",
  "bg-orange-500/15 text-orange-600 dark:text-orange-400 ring-orange-500/30",
  "bg-amber-400/20 text-amber-700 dark:text-amber-400 ring-amber-400/40",
  "bg-blue-500/12 text-blue-600 dark:text-blue-400 ring-blue-500/30",
  "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 ring-emerald-500/30",
];
const toneOf = (v) => TONE_BY_BAND[Math.min(4, Math.max(0, Math.ceil(v / 2) - 1))];

const monthOf = (str) => Number(str.slice(5, 7)) - 1;
const yearOf = (str) => Number(str.slice(0, 4));
const shiftMonth = (str, delta) => {
  const d = new Date(yearOf(str), monthOf(str) + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/**
 * "Baholar" tabi — o'quvchi × dars-kuni matritsasi (1–10).
 *
 * Ustunlar davomat matritsasi bilan BIR XIL manbadan (dars kunlari), shuning
 * uchun ikkala tab bir xil kunlarni ko'rsatadi va o'qituvchi chalkashmaydi.
 *
 * Kim nima qila oladi (API_CONTRACT_grade_lesson_roles.md):
 *   o'qituvchi  — guruhidagi barcha bahoni qo'yadi/tahrirlaydi/o'chiradi
 *   yordamchi   — qo'yadi; tahrirlash/o'chirish FAQAT o'zi qo'yganini
 *   resepshin   — faqat ko'radi
 *   boshliq     — faqat o'chiradi (qo'ymaydi)
 *
 * @param {Object} props
 * @param {string} props.groupId
 * @param {Array} props.students
 * @param {boolean} props.canWrite - baho qo'yish (o'qituvchi/yordamchi)
 * @param {boolean} props.canDeleteAny - istalgan bahoni o'chirish (boshliq/o'qituvchi)
 * @param {string} [props.userId] - joriy hodim id (yordamchi "o'ziniki" uchun)
 */
function GradesTab({ groupId, students, ranks = {}, canWrite, canDeleteAny, userId = "" }) {
  const { t } = useTranslation();
  const [month, setMonth] = useState(currentMonth);
  const [days, setDays] = useState([]);
  const [today, setToday] = useState("");
  // `studentId|date` → "absent" | "excused" — shu kunda kelmagan (sababsiz yoki
  // sababli) o'quvchi; ikkalasiga ham baho qo'yilmaydi. Faqat bugun uchun emas,
  // oyning barcha kunlari uchun (o'qituvchi o'tgan kunlarga ham baho qo'ya
  // oladi, shuning uchun cheklov ham shunga mos).
  const [blockedMap, setBlockedMap] = useState(() => new Map());
  const blockedStatus = useCallback(
    (studentId, date) => blockedMap.get(`${studentId}|${date}`) || null,
    [blockedMap],
  );
  const isAbsentDay = useCallback(
    (studentId, date) => blockedMap.has(`${studentId}|${date}`),
    [blockedMap],
  );
  // Toast/title kaliti — sababli va sababsiz uchun alohida matn.
  const blockedKey = (status) => (status === "excused" ? "grade.studentExcused" : "grade.studentAbsent");
  const [grades, setGrades] = useState({});
  const [averages, setAverages] = useState({});
  const [loading, setLoading] = useState(true);
  const [picker, setPicker] = useState(null); // { studentId, date, x, y }
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(""); // mobil kun tanlovi
  const scrollRef = useRef(null);
  const dateScrollRef = useRef(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      // Kunlar davomat endpointidan (yagona manba), baholar o'zidan.
      const [monthRes, gradeRes] = await Promise.all([
        api.get(`/attendance/${groupId}/month`, { params: { month } }),
        api.get(`/grades/${groupId}`, { params: { month } }),
      ]);
      if (monthRes.data.ok) {
        const payload = monthRes.data.data;
        setDays(payload.days || []);
        setToday(payload.today || "");
        // Har kuni (faqat bugun emas) kelmagan (absent/excused) o'quvchi — o'sha
        // kunga baho qo'yish taqiqlanadi, bugungisi esa qatorni xiralashtiradi.
        const pairs = [];
        for (const s of payload.students || []) {
          for (const [date, rec] of Object.entries(s.records || {})) {
            if (rec.status === "absent" || rec.status === "excused") {
              pairs.push([`${s.studentId}|${date}`, rec.status]);
            }
          }
        }
        setBlockedMap(new Map(pairs));
      }
      if (gradeRes.data.ok) {
        setGrades(gradeRes.data.data.grades || {});
        setAverages(gradeRes.data.data.averages || {});
      }
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setLoading(false);
    }
  }, [groupId, month]);

  useEffect(() => {
    const id = setTimeout(fetchAll, 0);
    return () => clearTimeout(id);
  }, [fetchAll]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [month, loading]);

  // Mobil kun tanlovi — davomat tabidagi bilan bir xil naqsh: bugungi kun
  // (agar shu oy ichida bo'lsa) yoki oyning oxirgi dars kuni default.
  useEffect(() => {
    if (!days.length) return;
    const id = setTimeout(() => {
      setSelectedDate((prev) => {
        if (prev && days.some((d) => d.date === prev)) return prev;
        const todayDay = days.find((d) => d.date === today);
        return todayDay ? todayDay.date : days[days.length - 1].date;
      });
    }, 0);
    return () => clearTimeout(id);
  }, [days, today]);

  useEffect(() => {
    const el = dateScrollRef.current;
    if (!el || !selectedDate) return;
    const pill = el.querySelector(`[data-date="${selectedDate}"]`);
    if (pill) pill.scrollIntoView({ block: "nearest", inline: "center" });
  }, [selectedDate, month]);

  // O'rtacha bahoni qayta hisoblash — serverga qayta murojaat qilmasdan.
  const recalc = useCallback((map) => {
    const values = Object.values(map || {}).map((x) => x.value);
    if (!values.length) return 0;
    return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
  }, []);

  const patch = useCallback(
    (studentId, date, value, note = "", teacher = null) => {
      setGrades((prev) => {
        const map = { ...(prev[studentId] || {}) };
        if (value === null) delete map[date];
        // `teacher` — kim qo'ygani; yordamchi uchun "o'ziniki" qoidasi shunga tayanadi.
        else map[date] = { value, note, teacher: teacher ?? map[date]?.teacher ?? null };
        const next = { ...prev, [studentId]: map };
        setAverages((avg) => ({ ...avg, [studentId]: recalc(map) }));
        return next;
      });
    },
    [recalc],
  );

  // Boshqa qurilmadan qo'yilgan baho ham darhol ko'rinadi.
  useSocketEvent("grade:set", (p) => {
    if (p?.groupId !== groupId) return;
    if (p?.date?.slice(0, 7) !== month) return;
    patch(p.studentId, p.date, p.value, p.note || "", p.teacher || null);
  });
  useSocketEvent("grade:removed", (p) => {
    if (p?.groupId !== groupId) return;
    if (p?.date?.slice(0, 7) !== month) return;
    patch(p.studentId, p.date, null);
  });

  // Boshqa xodim (yoki QR/Barcode) davomatni belgilasa, xiralashtirish/cheklov
  // darhol o'zgaradi — qayta yuklashsiz.
  useSocketEvent(
    "attendance:marked",
    (p) => {
      if (p?.groupId !== groupId || p?.date?.slice(0, 7) !== month) return;
      const pairKey = `${p.studentId}|${p.date}`;
      setBlockedMap((prev) => {
        const next = new Map(prev);
        if (p.status === "absent" || p.status === "excused") next.set(pairKey, p.status);
        else next.delete(pairKey);
        return next;
      });
    },
    !!groupId,
  );

  const isCurrent = month === currentMonth();
  const monthNames = t("common.monthNames", { returnObjects: true });
  const label = `${monthNames[monthOf(month)]} ${yearOf(month)}`;

  const setGrade = async (value) => {
    const { studentId, date } = picker;
    try {
      setSaving(true);
      const res = await api.post(`/grades/${groupId}`, { studentId, value, date });
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      patch(studentId, date, value, "", userId || null);
      setPicker(null);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setSaving(false);
    }
  };

  const hasDays = days.length > 0;
  const rows = useMemo(() => students || [], [students]);
  const selectedDay = useMemo(
    () => days.find((d) => d.date === selectedDate) || null,
    [days, selectedDate],
  );

  return (
    <div className="flex flex-col flex-1 gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-night-800 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer transition-colors"
          >
            <HiChevronLeft />
          </button>
          <span className="min-w-32 text-center text-sm font-semibold text-slate-800 dark:text-slate-100 capitalize">
            {label}
          </span>
          <button
            type="button"
            disabled={isCurrent}
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 dark:text-slate-500 enabled:hover:bg-slate-100 dark:enabled:hover:bg-night-800 enabled:hover:text-slate-700 dark:enabled:hover:text-slate-300 enabled:cursor-pointer disabled:opacity-30 transition-colors"
          >
            <HiChevronRight />
          </button>
        </div>
      </div>

      {loading ? (
        <MatrixSkeleton rows={students?.length || 6} rowHeight={49} />
      ) : !hasDays ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-400 dark:text-slate-500">
          {t("group.monthlyEmpty")}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-400 dark:text-slate-500">
          {t("group.monthlyNoStudents")}
        </div>
      ) : (
        <>
        {/* Mobil (<768px) — kun tanlovi + kartalar ro'yxati, matritsa emas
            (MonthlyAttendance.jsx dagi bir xil UX konsepsiyasi). */}
        <div className="flex md:hidden flex-col gap-3">
          <div ref={dateScrollRef} className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-4 px-4">
            {days.map((d) => {
              const isToday = d.date === today;
              const active = d.date === selectedDate;
              return (
                <button
                  key={d.date}
                  type="button"
                  data-date={d.date}
                  onClick={() => setSelectedDate(d.date)}
                  className={`flex flex-col items-center justify-center shrink-0 w-11 h-12 rounded-xl border text-center transition-colors duration-150 ${
                    active
                      ? "bg-blue-500 border-blue-500 text-white"
                      : d.holiday
                        ? "bg-violet-50 dark:bg-violet-500/15 border-violet-200 dark:border-violet-500/30 text-violet-500"
                        : isToday
                          ? "bg-blue-50 dark:bg-blue-500/15 border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-400"
                          : "bg-white dark:bg-night-900 border-slate-200 dark:border-night-700 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  <span className={`text-[10px] font-semibold uppercase leading-tight ${active ? "text-white/80" : ""}`}>
                    {t(`group.dayShort.${d.day}`)}
                  </span>
                  <span className="text-sm font-bold tabular-nums leading-tight">
                    {Number(d.date.slice(8, 10))}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2 px-0.5">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {t("group.studentsCount", { count: rows.length })}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {rows.map((s, index) => {
              const rec = (grades[s._id] || {})[selectedDate];
              const mine = !rec?.teacher || String(rec.teacher) === String(userId);
              const blocked = blockedStatus(s._id, selectedDate);
              const absent = !!blocked;
              // Oldingi guruhdan o'tgan baho — faqat ko'rish (asl guruhida tahrirlanadi).
              const carried = !!rec?.transferred;
              const editable =
                canWrite && (canDeleteAny || mine) && !!selectedDay && !dayLocked(selectedDay) && !absent && !carried;
              const deletable = !!rec && !carried && (canDeleteAny || (canWrite && mine));
              return (
                <div
                  key={s._id}
                  className={`flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-night-900 border border-slate-200/70 dark:border-night-700/70 ${
                    absent ? "opacity-50" : ""
                  }`}
                >
                  <RowNumber value={index + 1} />
                  <Avatar user={{ _id: s._id, name: s.fullName, avatar: s.photo }} size={38} />
                  <span className="flex flex-1 items-center gap-1.5 min-w-0">
                    <span className="min-w-0 text-[13px] font-semibold text-slate-800 dark:text-slate-100 truncate leading-tight">
                      {s.fullName}
                    </span>
                    <RankMedal position={ranks[s._id]} size={19} />
                  </span>
                  <button
                    type="button"
                    disabled={carried || (!editable && !deletable && !absent)}
                    title={carried ? t("group.transferredRecord") : undefined}
                    onClick={(e) => {
                      if (absent && !deletable) {
                        errorMsg(blockedKey(blocked), { date: selectedDate });
                        return;
                      }
                      const r = e.currentTarget.getBoundingClientRect();
                      setPicker({
                        studentId: s._id,
                        date: selectedDate,
                        gradeExists: !!rec,
                        editable,
                        deletable,
                        x: r.left + r.width / 2,
                        y: r.bottom + 6,
                      });
                    }}
                    className={`flex items-center justify-center shrink-0 w-11 h-11 rounded-2xl ring-1 ring-inset text-base font-bold tabular-nums transition-all duration-150 ${
                      rec ? toneOf(rec.value) : "bg-slate-100 dark:bg-night-800 ring-slate-200 dark:ring-night-700 text-slate-300 dark:text-slate-600"
                    } ${carried ? "outline-1 outline-dashed outline-offset-1 outline-slate-400" : ""} ${
                      !editable && !deletable
                        ? "cursor-default opacity-70"
                        : "cursor-pointer active:scale-95"
                    }`}
                  >
                    {rec?.value ?? "—"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Desktop/tablet (>=768px) — mavjud matritsa ko'rinishi. `isolate`
            — sticky ustunlar mobil tab bar (z-2) ustidan chiqmasin. */}
        <div ref={scrollRef} className="hidden md:block w-full isolate overflow-x-auto rounded-xl border border-slate-200 dark:border-night-700">
          <table className="w-max min-w-full border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 w-40 min-w-40 sm:w-56 sm:min-w-56 px-2 sm:px-3 py-2 bg-slate-50 dark:bg-night-800 border-b border-r border-slate-200 dark:border-night-700 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {t("student.fullName")}
                </th>
                {days.map((d) => (
                  <th
                    key={d.date}
                    title={d.transferred ? `${d.date} · ${t("group.transferredDay")}` : d.date}
                    className={`w-11 min-w-11 px-1 py-1.5 border-b border-slate-200 dark:border-night-700 text-center ${
                      d.holiday ? "bg-violet-50 dark:bg-violet-500/15" : d.transferred ? "bg-slate-100/70 dark:bg-night-800/70" : d.date === today ? "bg-blue-50/70 dark:bg-blue-500/15" : "bg-slate-50 dark:bg-night-800"
                    }`}
                  >
                    <span
                      className={`block text-[10px] font-semibold uppercase leading-tight ${
                        d.holiday ? "text-violet-500" : d.date === today ? "text-blue-500" : "text-slate-400 dark:text-slate-500"
                      }`}
                    >
                      {t(`group.dayShort.${d.day}`)}
                    </span>
                    <span
                      className={`block text-[13px] font-semibold tabular-nums leading-tight ${
                        d.holiday ? "text-violet-600 dark:text-violet-400" : d.date === today ? "text-blue-700 dark:text-blue-400" : "text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {Number(d.date.slice(8, 10))}
                    </span>
                  </th>
                ))}
                <th className="hidden sm:table-cell sticky right-0 z-20 w-20 min-w-20 px-2 py-2 bg-slate-50 dark:bg-night-800 border-b border-l border-slate-200 dark:border-night-700 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {t("grade.average")}
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map((s, index) => {
                const map = grades[s._id] || {};
                const avg = averages[s._id] || 0;
                return (
                  <tr
                    key={s._id}
                    className={`group/row ${isAbsentDay(s._id, today) ? "opacity-50" : ""}`}
                  >
                    <td className="sticky left-0 z-10 w-40 min-w-40 sm:w-56 sm:min-w-56 px-2 sm:px-3 py-2 bg-white dark:bg-night-900 border-b border-r border-slate-100 dark:border-night-700 group-hover/row:bg-slate-50 dark:row:bg-night-800 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <RowNumber value={index + 1} />
                        <Avatar user={{ _id: s._id, name: s.fullName, avatar: s.photo }} size={32} />
                        <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 truncate leading-tight">
                          {s.fullName}
                        </span>
                        <RankMedal position={ranks[s._id]} size={19} />
                      </div>
                    </td>

                    {days.map((d) => {
                      const rec = map[d.date];
                      const blocked = blockedStatus(s._id, d.date);
                      const absent = !!blocked;
                      // Yordamchi begona bahoga tegmaydi (server ham rad etadi).
                      const mine = !rec?.teacher || String(rec.teacher) === String(userId);
                      const carried = !!rec?.transferred || !!d.transferred;
                      const editable = canWrite && (canDeleteAny || mine) && !absent && !carried;
                      const deletable = !!rec && !carried && (canDeleteAny || (canWrite && mine));
                      // Kelmagan kunda ham (rec yo'q/deletable emas bo'lsa) tugma
                      // "disabled" QILINMAYDI — bosilganda sabab toast bilan
                      // ko'rsatiladi, shunchaki jim ishlamay turmaydi.
                      const locked =
                        d.future || !!d.holiday || carried || (!editable && !deletable && !absent);
                      return (
                        <td
                          key={d.date}
                          className={`w-11 min-w-11 p-1 border-b border-slate-100 dark:border-night-700 text-center align-middle ${
                            d.holiday ? "bg-violet-50/40 dark:bg-violet-500/15" : blocked === "excused" ? "bg-amber-50/60 dark:bg-amber-500/15" : absent ? "bg-red-50/50 dark:bg-red-500/15" : d.date === today ? "bg-blue-50/40 dark:bg-blue-500/15" : ""
                          }`}
                        >
                          <button
                            type="button"
                            disabled={locked}
                            title={
                              carried
                                ? `${d.date} · ${rec ? `${rec.value} · ` : ""}${t(
                                    rec?.transferred ? "group.transferredRecord" : "group.transferredDay",
                                  )}`
                                : rec
                                ? `${d.date} · ${rec.value}${rec.note ? ` — ${rec.note}` : ""}`
                                : absent
                                  ? t(blockedKey(blocked), { date: d.date })
                                  : `${d.date} · ${editable ? t("grade.pickValue") : "—"}`
                            }
                            onClick={(e) => {
                              if (absent && !deletable) {
                                errorMsg(blockedKey(blocked), { date: d.date });
                                return;
                              }
                              const r = e.currentTarget.getBoundingClientRect();
                              setPicker({
                                studentId: s._id,
                                date: d.date,
                                gradeExists: !!rec,
                                editable,
                                deletable,
                                x: r.left + r.width / 2,
                                y: r.bottom + 6,
                              });
                            }}
                            className={`flex items-center justify-center w-8 h-8 mx-auto rounded-xl ring-1 ring-inset text-[13px] font-bold tabular-nums transition-all duration-150 ${
                              rec
                                ? toneOf(rec.value)
                                : locked
                                  ? "bg-slate-50 dark:bg-night-800 ring-slate-200/70 dark:ring-night-700/70 text-transparent"
                                  : "bg-slate-100 dark:bg-night-800 ring-slate-200 dark:ring-night-700 text-transparent"
                            } ${
                              rec?.transferred
                                ? "outline-1 outline-dashed outline-offset-1 outline-slate-400"
                                : ""
                            } ${locked ? "cursor-default" : "cursor-pointer hover:brightness-95 active:scale-90"}`}
                          >
                            {rec?.value ?? "0"}
                          </button>
                        </td>
                      );
                    })}

                    <td className="hidden sm:table-cell sticky right-0 z-10 w-20 min-w-20 px-2 py-2 bg-white dark:bg-night-900 border-b border-l border-slate-100 dark:border-night-700 group-hover/row:bg-slate-50 dark:row:bg-night-800 transition-colors text-center">
                      <span
                        className={`text-[13px] font-semibold tabular-nums ${
                          avg >= 8 ? "text-emerald-600 dark:text-emerald-400" : avg >= 6 ? "text-amber-600 dark:text-amber-400" : avg > 0 ? "text-red-500" : "text-slate-300 dark:text-slate-600"
                        }`}
                      >
                        {avg || "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

      {picker &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => !saving && setPicker(null)} />
            <div
              style={{
                position: "fixed",
                top: Math.min(picker.y, window.innerHeight - 120),
                left: Math.max(8, Math.min(picker.x - 100, window.innerWidth - 208)),
                zIndex: 50,
              }}
              className="flex flex-col gap-1 w-52 p-2 rounded-xl bg-white dark:bg-night-900 border border-slate-200 dark:border-night-700 shadow-xl dark:shadow-none"
            >
              <span className="px-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500 tabular-nums">
                {picker.date}
              </span>
              {picker.editable && (
              <div className="flex flex-col gap-1.5">
                {VALUE_ROWS.map((row) => (
                  <div key={row[0]} className="flex items-center gap-1.5">
                    {row.map((v) => (
                      <button
                        key={v}
                        type="button"
                        disabled={saving}
                        onClick={() => setGrade(v)}
                        className={`flex items-center justify-center w-8 h-8 rounded-xl ring-1 ring-inset text-sm font-bold tabular-nums cursor-pointer disabled:opacity-50 hover:brightness-95 active:scale-90 transition-all ${toneOf(v)}`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
              )}
              {picker.gradeExists && picker.deletable && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={async () => {
                    try {
                      setSaving(true);
                      // Baho o'chirish — `date` bo'yicha topib DELETE qilinadi.
                      const list = await api.get(
                        `/grades/${groupId}/student/${picker.studentId}`,
                      );
                      const found = (list.data.data || []).find((g) => g.date === picker.date);
                      if (found) await api.delete(`/grades/${groupId}/${found._id}`);
                      patch(picker.studentId, picker.date, null);
                      setPicker(null);
                    } catch (error) {
                      errorMsg(error.message);
                    } finally {
                      setSaving(false);
                    }
                  }}
                  className="flex items-center justify-start gap-1 px-2 h-8 rounded-lg text-[13px] font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/15 cursor-pointer transition-colors"
                >
                  <HiTrash />
                  {t("grade.remove")}
                </button>
              )}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}

export default GradesTab;
