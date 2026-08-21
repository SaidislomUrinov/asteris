import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi2";
import Avatar from "../../ui/Avatar";
import AttendanceCheckbox from "./AttendanceCheckbox";
import MatrixSkeleton from "./MatrixSkeleton";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { api } from "../../utils/fetching";
import { errorMsg } from "../../utils/alert";

const MONTH_KEYS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

// Izohlar qatori va tanlash menyusi uchun ranglar. Katakning o'zi
// `AttendanceCheckbox` da chiziladi — ikonlar ham o'sha yerda.
const CELL = {
  present: { dot: "bg-emerald-500" },
  absent: { dot: "bg-red-500" },
  excused: { dot: "bg-amber-500" },
};

const STATUSES = ["present", "absent", "excused"];

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
 * "Oylik davomat" tabi — o'quvchi × dars-kuni matritsasi.
 *
 * Ustunlar faqat SHU guruhning haqiqiy dars kunlari (server hisoblaydi:
 * hafta kunlari + faollashgan sana + dam olish kunlari chegirmasi), ortiqcha
 * bo'sh ustun bo'lmaydi. Belgilanmay qolib ketgan katakni bosib to'g'rilash
 * mumkin (`POST /attendance/:groupId/mark` + `date`).
 *
 * Mobilda jadval o'z konteyneri ichida X o'qi bo'yicha suriladi, o'quvchi
 * ustuni esa chapda yopishib turadi — ustunlar bir-birining ustiga chiqmaydi.
 *
 * @param {Object} props
 * @param {string} props.groupId
 * @param {Array} props.students - Guruh detail allaqachon yuklagan ro'yxat
 * @param {boolean} props.canMark - `attendance:create` ruxsati
 * @param {string} [props.minDate] - shu sanadan oldingi kunlar belgilanmaydi
 *   (o'qituvchi faqat bugun/kecha uchun belgilay oladi — server ham shuni
 *   majburlaydi, bu UI tomonidagi aks-sadosi)
 *
 * Davomat belgilanganda matritsa QAYTA YUKLANMAYDI — o'zgargan katak
 * (va o'sha o'quvchining foizi) socket eventi asosida joyida yangilanadi.
 */
function MonthlyAttendance({ groupId, students, canMark, minDate = "" }) {
  const { t } = useTranslation();
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [picker, setPicker] = useState(null); // { studentId, date, x, y }
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef(null);

  const fetchMonth = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/attendance/${groupId}/month`, { params: { month } });
      const { ok, data: payload, msg } = res.data;
      if (!ok) throw new Error(msg);
      setData(payload);
    } catch (error) {
      errorMsg(error.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [groupId, month]);

  // `setTimeout(…, 0)` — so'rov effekt tanasidan tashqarida boshlanadi
  // (react-hooks/set-state-in-effect), loyihada shu naqsh ishlatiladi.
  useEffect(() => {
    const id = setTimeout(fetchMonth, 0);
    return () => clearTimeout(id);
  }, [fetchMonth]);

  // Yangi oy ochilganda oxirgi kunlar ko'rinib tursin — qabulxonachi
  // odatda eng so'nggi darslar bilan ishlaydi. Bog'liqlik AYNAN `data.month`:
  // katak belgilanganda `data` yangilanadi, lekin oy o'zgarmaydi — aks holda
  // har belgilashda jadval o'zi oxirgi kunga sirg'alib ketardi (mobilda
  // foydalanuvchi qayerda ishlayotganini yo'qotardi).
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [data?.month]);

  const byStudent = useMemo(() => {
    const map = new Map();
    for (const s of data?.students || []) map.set(s.studentId, s);
    return map;
  }, [data]);

  const isCurrent = month === currentMonth();
  const label = `${t(`common.monthNames.${monthOf(month)}`, MONTH_KEYS[monthOf(month)])} ${yearOf(month)}`;

  // Bitta katakni joyida yangilaydi va o'sha o'quvchining foizini qayta
  // hisoblaydi — serverdan qayta so'ramaymiz.
  const patchCell = useCallback(({ studentId, date, status, reason = "", late = false }) => {
    setData((prev) => {
      if (!prev) return prev;
      const students = prev.students.map((s) => {
        if (s.studentId !== studentId) return s;
        const records = { ...s.records, [date]: { status, late, reason } };
        const counts = { present: 0, absent: 0, excused: 0 };
        for (const r of Object.values(records)) {
          if (counts[r.status] !== undefined) counts[r.status] += 1;
        }
        const marked = counts.present + counts.absent + counts.excused;
        return {
          ...s,
          records,
          ...counts,
          marked,
          percent: marked ? Math.round((counts.present / marked) * 100) : 0,
        };
      });
      return { ...prev, students };
    });
  }, []);

  // Boshqa xodim (yoki QR/Barcode skaner) belgilasa ham matritsa darhol
  // o'zgaradi — faqat o'sha katak, qayta yuklashsiz.
  useSocketEvent(
    "attendance:marked",
    (payload) => {
      if (payload?.groupId !== groupId) return;
      if (payload?.date?.slice(0, 7) !== month) return;
      patchCell({
        studentId: payload.studentId,
        date: payload.date,
        status: payload.status,
        reason: payload.reason || "",
        late: !!payload.late,
      });
    },
    !!groupId,
  );

  const mark = async (status, reason = "") => {
    const { studentId, date } = picker;
    try {
      setSaving(true);
      const res = await api.post(`/attendance/${groupId}/mark`, {
        studentId,
        status,
        reason,
        date,
      });
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      // Socket eventi ham keladi, lekin katak darhol o'zgarishi kerak
      // (natija bir xil — `patchCell` idempotent).
      patchCell({ studentId, date, status, reason });
      setPicker(null);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    // `flex-1` — ota konteynerdagi barqaror maydonni to'ldiradi, shuning
    // uchun yuklanishdan jadvalga o'tishda blok balandligi sakramaydi.
    <div className="flex flex-col flex-1 gap-3">
      {/* Oy navigatsiyasi */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            title={t("group.monthlyPrevMonth")}
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
            title={t("group.monthlyNextMonth")}
            disabled={isCurrent}
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 enabled:hover:bg-slate-100 enabled:hover:text-slate-700 enabled:cursor-pointer disabled:opacity-30 transition-colors"
          >
            <HiChevronRight />
          </button>
        </div>

        {/* Katta ekranda izohlar sarlavha qatorida; mobilda sig'magani
            uchun jadval OSTIGA tushadi. */}
        <Legend t={t} className="hidden sm:flex" />
      </div>

      {loading ? (
        <MatrixSkeleton rows={students.length || 6} rowHeight={52} />
      ) : !data || data.days.length === 0 ? (
        <div className="flex flex-col flex-1 items-center justify-center gap-1 text-center">
          <p className="text-sm font-medium text-slate-500">{t("group.monthlyEmpty")}</p>
          <p className="text-xs text-slate-400">{t("group.monthlyEmptyHint")}</p>
        </div>
      ) : students.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
          {t("group.monthlyNoStudents")}
        </div>
      ) : (
        /* `isolate` — jadvaldagi sticky ustunlar (z-10/z-20) SHU konteyner
           ichida qatlamlanadi. Aks holda ular ilovaning kichik z-shkalasidan
           (mobil tab bar `z-2`, Navbar `z-3`) oshib ketib, tab bar ustidan
           chiqib qolardi. */
        <div
          ref={scrollRef}
          className="w-full isolate overflow-x-auto rounded-xl border border-slate-200"
        >
          {/* `w-max` — jadval kontent kengligiga cho'ziladi, ustunlar
              siqilib bir-birining ustiga chiqmaydi. */}
          <table className="w-max min-w-full border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 w-36 min-w-36 sm:w-52 sm:min-w-52 px-2 sm:px-3 py-2 bg-slate-50 border-b border-r border-slate-200 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {t("student.fullName")}
                </th>
                {data.days.map((d) => {
                  const today = d.date === data.today;
                  return (
                    <th
                      key={d.date}
                      title={
                        d.holiday
                          ? `${t("group.monthlyHoliday")}${d.holiday.note ? ` — ${d.holiday.note}` : ""}`
                          : d.date
                      }
                      className={`w-11 min-w-11 px-1 py-1.5 border-b border-slate-200 text-center ${
                        d.holiday ? "bg-violet-50" : today ? "bg-blue-50/70" : "bg-slate-50"
                      }`}
                    >
                      <span
                        className={`block text-[10px] font-semibold uppercase leading-tight ${
                          d.holiday ? "text-violet-500" : today ? "text-blue-500" : "text-slate-400"
                        }`}
                      >
                        {t(`group.dayShort.${d.day}`)}
                      </span>
                      <span
                        className={`block text-[13px] font-semibold tabular-nums leading-tight ${
                          d.holiday
                            ? "text-violet-600"
                            : today
                              ? "text-blue-700"
                              : d.future
                                ? "text-slate-400"
                                : "text-slate-700"
                        }`}
                      >
                        {Number(d.date.slice(8, 10))}
                      </span>
                    </th>
                  );
                })}
                {/* Mobilda foiz ustuni ko'rsatilmaydi — tor ekranda kunlarga
                    joy qolishi muhimroq (foiz katta ekranda ko'rinadi). */}
                <th className="hidden sm:table-cell sticky right-0 z-20 w-24 min-w-24 px-2 py-2 bg-slate-50 border-b border-l border-slate-200 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {t("group.monthlyAttendanceRate")}
                </th>
              </tr>
            </thead>

            <tbody>
              {students.map((s) => {
                const row = byStudent.get(s._id);
                return (
                  <tr key={s._id} className="group/row">
                    <td className="sticky left-0 z-10 w-36 min-w-36 sm:w-52 sm:min-w-52 px-2 sm:px-3 py-2 bg-white border-b border-r border-slate-100 group-hover/row:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar user={{ _id: s._id, name: s.fullName }} size={32} />
                        <div className="flex flex-col min-w-0">
                          <span className="text-[13px] font-semibold text-slate-800 truncate leading-tight">
                            {s.fullName}
                          </span>
                          <span className="hidden sm:block text-[11px] text-slate-400 truncate leading-tight">
                            {s.phone}
                          </span>
                        </div>
                      </div>
                    </td>

                    {data.days.map((d) => {
                      const rec = row?.records?.[d.date];
                      const today = d.date === data.today;
                      // Dam olish kuni — barcha o'quvchida bir xil savol belgisi,
                      // belgilash mumkin emas. Kelajakdagi dars kuni ham
                      // belgilanmaydi (server rad etadi).
                      const holiday = d.holiday;
                      // O'qituvchi faqat bugun/kecha uchun belgilaydi —
                      // undan eskisi qulflanadi (server ham rad etadi).
                      const tooOld = !!minDate && d.date < minDate;
                      const locked = !!holiday || d.future || tooOld;
                      const title = holiday
                        ? `${d.date} · ${t("group.monthlyHoliday")} — ${
                            holiday.note ||
                            t(holiday.chargeable ? "group.holidayChargeable" : "group.holidayNotChargeable")
                          }`
                        : d.future
                          ? `${d.date} · ${t("group.monthlyFuture")}`
                          : tooOld
                            ? `${d.date} · ${t("attendance.teacherDateLimit")}`
                          : rec
                            ? `${d.date} · ${t(`group.attendance${rec.status[0].toUpperCase()}${rec.status.slice(1)}`)}${
                                rec.reason ? ` — ${rec.reason}` : ""
                              }`
                            : `${d.date} · ${t("group.attendanceUnmarked")}${
                                canMark ? ` — ${t("group.monthlyLegend")}` : ""
                              }`;
                      return (
                        <td
                          key={d.date}
                          className={`w-11 min-w-11 p-1 border-b border-slate-100 text-center align-middle ${
                            holiday ? "bg-violet-50/40" : today ? "bg-blue-50/40" : ""
                          }`}
                        >
                          <AttendanceCheckbox
                            className="mx-auto"
                            status={rec?.status}
                            holiday={!!holiday}
                            future={d.future}
                            disabled={!canMark || locked}
                            title={title}
                            onClick={(e) => {
                              const r = e.currentTarget.getBoundingClientRect();
                              setPicker({
                                studentId: s._id,
                                date: d.date,
                                x: r.left + r.width / 2,
                                y: r.bottom + 6,
                              });
                            }}
                          />
                        </td>
                      );
                    })}

                    <td className="hidden sm:table-cell sticky right-0 z-10 w-24 min-w-24 px-2 py-2 bg-white border-b border-l border-slate-100 group-hover/row:bg-slate-50 transition-colors">
                      <PercentCell
                        percent={row?.percent || 0}
                        title={t("group.monthlyMarkedOf", {
                          marked: row?.marked || 0,
                          present: row?.present || 0,
                        })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobil: izohlar jadval ostida, o'ralib chiqadi */}
      {!loading && data && data.days.length > 0 && students.length > 0 && (
        <Legend t={t} className="flex sm:hidden flex-wrap gap-y-1" />
      )}

      {/* Katakni belgilash — kichik menyu, katak ostida ochiladi */}
      {picker &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => !saving && setPicker(null)} />
            <div
              style={{
                position: "fixed",
                top: Math.min(picker.y, window.innerHeight - 150),
                left: Math.max(8, Math.min(picker.x - 80, window.innerWidth - 168)),
                zIndex: 50,
              }}
              className="flex flex-col gap-0.5 w-40 p-1 rounded-xl bg-white border border-slate-200 shadow-xl"
            >
              <span className="px-2 py-1 text-[11px] font-semibold text-slate-400 tabular-nums">
                {picker.date}
              </span>
              {STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={saving}
                  onClick={() => mark(s)}
                  className="flex items-center justify-start gap-1 w-full px-2 h-9 rounded-lg text-[13px] font-medium text-slate-700 text-left hover:bg-slate-50 disabled:opacity-50 cursor-pointer transition-colors"
                >
                  <AttendanceCheckbox status={s} disabled title="" onClick={() => {}} />
                  {t(`group.attendance${s[0].toUpperCase()}${s.slice(1)}`)}
                </button>
              ))}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}

// Status izohlari — sarlavhada (desktop) yoki jadval ostida (mobil).
function Legend({ t, className = "" }) {
  return (
    <div className={`items-center gap-x-3 text-[11px] text-slate-400 ${className}`}>
      {STATUSES.map((s) => (
        <span key={s} className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${CELL[s].dot}`} />
          {t(`group.attendance${s[0].toUpperCase()}${s.slice(1)}Short`)}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
        {t("group.monthlyHoliday")}
      </span>
    </div>
  );
}

// Foiz — raqam va ostida ingichka progress chizig'i.
function PercentCell({ percent, title }) {
  const tone =
    percent >= 80 ? "text-emerald-600" : percent >= 50 ? "text-amber-600" : "text-red-500";
  const bar =
    percent >= 80 ? "bg-emerald-500" : percent >= 50 ? "bg-amber-500" : "bg-red-400";
  return (
    <div className="flex flex-col items-center gap-1" title={title}>
      <span className={`text-[13px] font-semibold tabular-nums ${tone}`}>{percent}%</span>
      <span className="w-full h-1 rounded-full bg-slate-100 overflow-hidden">
        <span className={`block h-full rounded-full ${bar}`} style={{ width: `${percent}%` }} />
      </span>
    </div>
  );
}

export default MonthlyAttendance;
