import { useCallback, useEffect, useMemo, useState } from "react";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { api } from "../../utils/fetching";
import { errorMsg } from "../../utils/alert";
import { tashkentToday } from "./homeworkResults";

/**
 * Bir oylik uyga vazifalar + shu oyning dars kunlari. "Uyga vazifa"
 * matritsasi va "Vazifa yuborish" modali ikkalasi ham shundan oziqlanadi.
 *
 * Dars kunlari yangi hisoblanmaydi:
 *   - joriy/o'tgan oylar — `GET /attendance/:groupId/month` (bayram va
 *     o'tkazilgan-kun ustunlari chiqarib tashlanadi);
 *   - kelgusi oylar — `useLessonSchedule` ning `lessonByDate` kalitlari.
 *
 * Boshqa qurilma/xodim yozgan vazifa va natijalar socket orqali joyida
 * yangilanadi (`homework:updated`, `homework:results`).
 *
 * @param {Object} p
 * @param {string} p.groupId
 * @param {string} p.month - "YYYY-MM"
 * @param {Object} [p.lessonByDate]
 * @param {boolean} [p.enabled=true]
 */
export function useHomeworkMonth({ groupId, month, lessonByDate = {}, enabled = true }) {
  const today = tashkentToday();
  const isFutureMonth = month > today.slice(0, 7);
  const [items, setItems] = useState({}); // date → item
  const [serverDays, setServerDays] = useState(null); // null → kelgusi oy
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refetch = useCallback(async () => {
    if (!groupId || !enabled) return;
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
        daysPayload ? daysPayload.days.filter((d) => !d.holiday && !d.transferred).map((d) => d.date) : null,
      );
    } catch (err) {
      errorMsg(err.message);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [groupId, month, isFutureMonth, enabled]);

  // `setTimeout(…, 0)` — loyihadagi react-hooks/set-state-in-effect naqshi.
  useEffect(() => {
    const id = setTimeout(refetch, 0);
    return () => clearTimeout(id);
  }, [refetch]);

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
        next[p.date] = { ...cur, date: p.date, text: p.text, updatedAt: p.updatedAt, updatedBy: p.updatedBy || null };
        return next;
      });
    },
    !!groupId && enabled,
  );

  useSocketEvent(
    "homework:results",
    (p) => {
      if (p?.groupId !== groupId) return;
      setItems((prev) => (prev[p.date] ? { ...prev, [p.date]: { ...prev[p.date], results: p.results || {} } } : prev));
    },
    !!groupId && enabled,
  );

  const lessonDays = useMemo(
    () => new Set(serverDays ?? Object.keys(lessonByDate).filter((d) => d.startsWith(`${month}-`))),
    [serverDays, lessonByDate, month],
  );

  return { items, setItems, lessonDays, loading, error, refetch, today };
}
