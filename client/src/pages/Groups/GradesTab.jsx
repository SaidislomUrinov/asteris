import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import { HiChevronLeft, HiChevronRight, HiTrash } from "react-icons/hi2";
import Avatar from "../../ui/Avatar";
import MatrixSkeleton from "./MatrixSkeleton";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { api } from "../../utils/fetching";
import { errorMsg } from "../../utils/alert";

const VALUES = [5, 4, 3, 2, 1];

// Baho rangi — 5/4 yashil-ko'k, 3 sariq, 2/1 qizil. Brend shkalasi
// (emerald/blue/amber/red) davomat kataklari bilan bir xil oilada.
const TONE = {
  5: "bg-emerald-500 text-white border-emerald-500",
  4: "bg-blue-500 text-white border-blue-500",
  3: "bg-amber-500 text-white border-amber-500",
  2: "bg-orange-500 text-white border-orange-500",
  1: "bg-red-500 text-white border-red-500",
};

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
 * "Baholar" tabi — o'quvchi × dars-kuni matritsasi (1–5).
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
function GradesTab({ groupId, students, canWrite, canDeleteAny, userId = "" }) {
  const { t } = useTranslation();
  const [month, setMonth] = useState(currentMonth);
  const [days, setDays] = useState([]);
  const [grades, setGrades] = useState({});
  const [averages, setAverages] = useState({});
  const [loading, setLoading] = useState(true);
  const [picker, setPicker] = useState(null); // { studentId, date, x, y }
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      // Kunlar davomat endpointidan (yagona manba), baholar o'zidan.
      const [monthRes, gradeRes] = await Promise.all([
        api.get(`/attendance/${groupId}/month`, { params: { month } }),
        api.get(`/grades/${groupId}`, { params: { month } }),
      ]);
      if (monthRes.data.ok) setDays(monthRes.data.data.days || []);
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

  return (
    <div className="flex flex-col flex-1 gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer transition-colors"
          >
            <HiChevronLeft />
          </button>
          <span className="min-w-32 text-center text-sm font-semibold text-slate-800 capitalize">
            {label}
          </span>
          <button
            type="button"
            disabled={isCurrent}
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 enabled:hover:bg-slate-100 enabled:hover:text-slate-700 enabled:cursor-pointer disabled:opacity-30 transition-colors"
          >
            <HiChevronRight />
          </button>
        </div>
      </div>

      {loading ? (
        <MatrixSkeleton rows={students?.length || 6} rowHeight={49} />
      ) : !hasDays ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
          {t("group.monthlyEmpty")}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
          {t("group.monthlyNoStudents")}
        </div>
      ) : (
        /* `isolate` — sticky ustunlar mobil tab bar (z-2) ustidan chiqmasin */
        <div ref={scrollRef} className="w-full isolate overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-max min-w-full border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 w-36 min-w-36 sm:w-52 sm:min-w-52 px-2 sm:px-3 py-2 bg-slate-50 border-b border-r border-slate-200 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {t("student.fullName")}
                </th>
                {days.map((d) => (
                  <th
                    key={d.date}
                    title={d.date}
                    className={`w-11 min-w-11 px-1 py-1.5 border-b border-slate-200 text-center ${
                      d.holiday ? "bg-violet-50" : "bg-slate-50"
                    }`}
                  >
                    <span className="block text-[10px] font-semibold uppercase leading-tight text-slate-400">
                      {t(`group.dayShort.${d.day}`)}
                    </span>
                    <span className="block text-[13px] font-semibold tabular-nums leading-tight text-slate-700">
                      {Number(d.date.slice(8, 10))}
                    </span>
                  </th>
                ))}
                <th className="hidden sm:table-cell sticky right-0 z-20 w-20 min-w-20 px-2 py-2 bg-slate-50 border-b border-l border-slate-200 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {t("grade.average")}
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map((s) => {
                const map = grades[s._id] || {};
                const avg = averages[s._id] || 0;
                return (
                  <tr key={s._id} className="group/row">
                    <td className="sticky left-0 z-10 w-36 min-w-36 sm:w-52 sm:min-w-52 px-2 sm:px-3 py-2 bg-white border-b border-r border-slate-100 group-hover/row:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar user={{ _id: s._id, name: s.fullName }} size={32} />
                        <span className="text-[13px] font-semibold text-slate-800 truncate leading-tight">
                          {s.fullName}
                        </span>
                      </div>
                    </td>

                    {days.map((d) => {
                      const rec = map[d.date];
                      // Yordamchi begona bahoga tegmaydi (server ham rad etadi).
                      const mine = !rec?.teacher || String(rec.teacher) === String(userId);
                      const editable = canWrite && (canDeleteAny || mine);
                      const deletable = !!rec && (canDeleteAny || (canWrite && mine));
                      const locked = (!editable && !deletable) || d.future || !!d.holiday;
                      return (
                        <td
                          key={d.date}
                          className={`w-11 min-w-11 p-1 border-b border-slate-100 text-center align-middle ${
                            d.holiday ? "bg-violet-50/40" : ""
                          }`}
                        >
                          <button
                            type="button"
                            disabled={locked}
                            title={
                              rec
                                ? `${d.date} · ${rec.value}${rec.note ? ` — ${rec.note}` : ""}`
                                : `${d.date} · ${editable ? t("grade.pickValue") : "—"}`
                            }
                            onClick={(e) => {
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
                            className={`flex items-center justify-center w-7 h-7 mx-auto rounded-md border text-[13px] font-bold transition-all duration-150 ${
                              rec ? TONE[rec.value] : "bg-slate-200 border-slate-300 text-transparent"
                            } ${
                              locked
                                ? "cursor-default"
                                : "cursor-pointer hover:border-slate-400 hover:brightness-95 active:scale-95"
                            }`}
                          >
                            {rec?.value ?? "0"}
                          </button>
                        </td>
                      );
                    })}

                    <td className="hidden sm:table-cell sticky right-0 z-10 w-20 min-w-20 px-2 py-2 bg-white border-b border-l border-slate-100 group-hover/row:bg-slate-50 transition-colors text-center">
                      <span
                        className={`text-[13px] font-semibold tabular-nums ${
                          avg >= 4 ? "text-emerald-600" : avg >= 3 ? "text-amber-600" : avg > 0 ? "text-red-500" : "text-slate-300"
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
              className="flex flex-col gap-1 w-52 p-2 rounded-xl bg-white border border-slate-200 shadow-xl"
            >
              <span className="px-1 text-[11px] font-semibold text-slate-400 tabular-nums">
                {picker.date}
              </span>
              {picker.editable && (
              <div className="flex items-center gap-1.5">
                {VALUES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    disabled={saving}
                    onClick={() => setGrade(v)}
                    className={`flex items-center justify-center w-8 h-8 rounded-lg border text-sm font-bold cursor-pointer disabled:opacity-50 hover:brightness-95 active:scale-95 transition-all ${TONE[v]}`}
                  >
                    {v}
                  </button>
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
                  className="flex items-center justify-start gap-1 px-2 h-8 rounded-lg text-[13px] font-medium text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
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
