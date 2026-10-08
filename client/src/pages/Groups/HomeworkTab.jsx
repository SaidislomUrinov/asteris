import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiOutlineClipboardDocumentList } from "react-icons/hi2";
import MonthNav from "../../ui/MonthNav";
import Button from "../../ui/Button";
import HomeworkDayCard from "./HomeworkDayCard";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";

const monthOf = (str) => Number(str.slice(5, 7)) - 1;
const yearOf = (str) => Number(str.slice(0, 4));

// Asia/Tashkent bo'yicha bugungi kun — Homework.date ham shu kalendarda.
const tashkentToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date());

const addDays = (dateStr, delta) => {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * "Uyga vazifa" tabi — GroupDetail (`/groups/:id`) va `/lesson` sahifalari
 * uchun YAGONA komponent (API_CONTRACT_student_role_homework.md §8).
 *
 * Dars kunlari yangi hisoblanmaydi, mavjud manbalardan olinadi:
 *   - joriy va o'tgan oylar — `GET /attendance/:groupId/month` (Davomat va
 *     Baholar tablari bilan bir xil ustunlar; bayram va o'tkazilgan-kun
 *     ustunlari chiqarib tashlanadi);
 *   - kelgusi oylar (u endpoint kelajak oyni qaytarmaydi) — `useLessonSchedule`
 *     hisoblagan `lessonByDate` kalitlari (hafta kunlari − guruh dam olish kunlari).
 * Qaysi kunga vazifa yozilgan bo'lsa, u kun ro'yxatda har doim ko'rinadi.
 *
 * @param {Object} props
 * @param {string} props.groupId
 * @param {boolean} props.canWrite - `attendance:create`
 * @param {Object} [props.lessonByDate] - useLessonSchedule: sana → syllabus darsi
 * @param {(date: Date) => void} [props.extendTo] - useLessonSchedule hisob oralig'ini cho'zish
 */
function HomeworkTab({ groupId, canWrite, lessonByDate = {}, extendTo }) {
  const { t } = useTranslation();
  const today = tashkentToday();
  const tomorrow = addDays(today, 1);
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [items, setItems] = useState({}); // date → item
  const [serverDays, setServerDays] = useState(null); // null → kelgusi oy
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const isFutureMonth = month > today.slice(0, 7);

  const fetchMonth = useCallback(async () => {
    if (!groupId) return;
    try {
      setLoading(true);
      setError(false);
      const [hwRes, daysRes] = await Promise.all([
        api.get(`/homework/${groupId}`, { params: { month } }),
        isFutureMonth
          ? Promise.resolve(null)
          : api.get(`/attendance/${groupId}/month`, { params: { month } }).catch(() => null),
      ]);
      const { ok, data, msg } = hwRes.data;
      if (!ok) throw new Error(msg);
      setItems(Object.fromEntries((data?.items || []).map((i) => [i.date, i])));
      const daysPayload = daysRes?.data?.ok ? daysRes.data.data : null;
      setServerDays(
        daysPayload
          ? daysPayload.days.filter((d) => !d.holiday && !d.transferred).map((d) => d.date)
          : null,
      );
    } catch (err) {
      errorMsg(err.message);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [groupId, month, isFutureMonth]);

  useEffect(() => {
    const id = setTimeout(fetchMonth, 0);
    return () => clearTimeout(id);
  }, [fetchMonth]);

  // Kelgusi oy ochilsa — useLessonSchedule o'sha oy oxirigacha hisoblasin.
  useEffect(() => {
    extendTo?.(new Date(yearOf(month), monthOf(month) + 1, 0));
  }, [month, extendTo]);

  // Boshqa qurilma/xodim yozgan vazifa — refetch'siz joyida yangilanadi.
  useSocketEvent(
    "homework:updated",
    (p) => {
      if (p?.groupId !== groupId || !p?.date?.startsWith(`${month}-`)) return;
      setItems((prev) => {
        const next = { ...prev };
        if (!p.text) {
          delete next[p.date];
          return next;
        }
        const cur = prev[p.date];
        // O'zimizning saqlashimiz aks-sadosi — PUT javobidagi (ism bilan) yozuv qoladi.
        if (cur && cur.text === p.text && cur.updatedAt === p.updatedAt) return prev;
        next[p.date] = {
          ...cur,
          date: p.date,
          text: p.text,
          updatedAt: p.updatedAt,
          updatedBy: p.updatedBy || null,
        };
        return next;
      });
    },
    !!groupId,
  );

  const saveDay = useCallback(
    async (date, text) => {
      try {
        const res = await api.put(`/homework/${groupId}/${date}`, { text });
        const { ok, data, msg } = res.data;
        if (!ok) throw new Error(msg);
        setItems((prev) => {
          const next = { ...prev };
          if (!text) delete next[date];
          else next[date] = data?.date ? data : { ...prev[date], date, text, updatedAt: Math.floor(Date.now() / 1000) };
          return next;
        });
        successMsg(msg || (text ? "homework.saved" : "homework.deleted"));
        return true;
      } catch (err) {
        errorMsg(err.message);
        return false;
      }
    },
    [groupId],
  );

  // Bugun va kelgusi kunlar yuqorida (o'sish tartibida), o'tganlar pastda
  // (eng yaqini birinchi).
  const { upcoming, past } = useMemo(() => {
    const base = serverDays ?? Object.keys(lessonByDate).filter((d) => d.startsWith(`${month}-`));
    const all = [...new Set([...base, ...Object.keys(items)])];
    return {
      upcoming: all.filter((d) => d >= today).sort(),
      past: all.filter((d) => d < today).sort().reverse(),
    };
  }, [serverDays, lessonByDate, items, month, today]);

  const monthNames = t("common.monthNames", { returnObjects: true });
  const label = `${monthNames[monthOf(month)]} ${yearOf(month)}`;

  const renderCard = (date, muted = false) => (
    <HomeworkDayCard
      key={date}
      date={date}
      badge={date === today ? "today" : date === tomorrow ? "tomorrow" : null}
      muted={muted}
      item={items[date] || null}
      suggestion={lessonByDate[date]?.homework || ""}
      canWrite={canWrite}
      onSave={saveDay}
    />
  );

  return (
    <div className="flex flex-col gap-3 flex-1">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <MonthNav month={month} label={label} onChange={setMonth} />
        {canWrite && <span className="hidden sm:inline text-[11px] text-slate-400 dark:text-slate-500">{t("homework.saveHint")}</span>}
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-slate-100 dark:bg-night-800 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-slate-400 dark:text-slate-500">
          {t("common.error")}
          <Button variant="outlined" color="slate" onClick={fetchMonth}>
            {t("common.retry")}
          </Button>
        </div>
      ) : upcoming.length + past.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500">
          <HiOutlineClipboardDocumentList className="text-3xl text-slate-300 dark:text-slate-600" />
          <span className="text-sm">{t("homework.empty")}</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {upcoming.map((date) => renderCard(date))}
          {past.length > 0 && (
            <div className="flex items-center gap-2 pt-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {t("homework.past")}
              </span>
              <div className="flex-1 h-px bg-slate-100 dark:bg-night-800" />
            </div>
          )}
          <div className="flex flex-col gap-2 opacity-90">{past.map((date) => renderCard(date, true))}</div>
        </div>
      )}
    </div>
  );
}

export default HomeworkTab;
