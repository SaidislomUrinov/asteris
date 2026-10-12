import { useCallback, useEffect, useState } from "react";
import { api } from "../../utils/fetching";
import { errorMsg } from "../../utils/alert";
import { useSocketEvent } from "../../hooks/useSocketEvent";

// Asia/Tashkent bo'yicha bugun — Grade.date ham shu kalendarda ("YYYY-MM-DD").
const todayTashkent = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  );

/**
 * Guruhning BUGUNGI baholari — soddalashtirilgan ro'yxat qatoridagi baho
 * katagi uchun (docs/API_CONTRACT_group_simple_view.md §2). Oylik "Baholar"
 * bo'limi bilan bir xil endpoint va socket hodisalari.
 *
 * @param {string} groupId
 * @param {boolean} enabled - ko'rinish huquqi bo'lsagina so'rov yuboriladi
 * @returns {{ today: string, grades: Record<string, number>, saving: string|null,
 *   setGrade: (studentId: string, value: number) => Promise<boolean>,
 *   removeGrade: (studentId: string) => Promise<boolean> }}
 */
export default function useTodayGrades(groupId, enabled) {
  const [today] = useState(todayTashkent);
  const [grades, setGrades] = useState({});
  const [saving, setSaving] = useState(null);

  const fetchGrades = useCallback(async () => {
    try {
      const res = await api.get(`/grades/${groupId}`, { params: { month: today.slice(0, 7) } });
      const { ok, data } = res.data;
      if (!ok) return;
      const map = {};
      for (const [sid, byDate] of Object.entries(data?.grades || {})) {
        if (byDate?.[today]?.value != null) map[sid] = byDate[today].value;
      }
      setGrades(map);
    } catch (error) {
      errorMsg(error.message);
    }
  }, [groupId, today]);

  useEffect(() => {
    if (!enabled || !groupId) return;
    const id = setTimeout(fetchGrades, 0);
    return () => clearTimeout(id);
  }, [enabled, groupId, fetchGrades]);

  const patch = (studentId, value) =>
    setGrades((prev) => {
      const next = { ...prev };
      if (value == null) delete next[studentId];
      else next[studentId] = value;
      return next;
    });

  // Boshqa qurilma/bo'limdan qo'yilgan baho ham darhol ko'rinadi.
  useSocketEvent(
    "grade:set",
    (p) => {
      if (p?.groupId !== groupId || p?.date !== today) return;
      patch(p.studentId, p.value);
    },
    enabled,
  );
  useSocketEvent(
    "grade:removed",
    (p) => {
      if (p?.groupId !== groupId || p?.date !== today) return;
      patch(p.studentId, null);
    },
    enabled,
  );

  const setGrade = async (studentId, value) => {
    try {
      setSaving(studentId);
      const res = await api.post(`/grades/${groupId}`, { studentId, value, date: today });
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      patch(studentId, value);
      return true;
    } catch (error) {
      errorMsg(error.message);
      return false;
    } finally {
      setSaving(null);
    }
  };

  const removeGrade = async (studentId) => {
    try {
      setSaving(studentId);
      // O'chirish id bo'yicha — sana orqali topiladi (GradesTab bilan bir xil).
      const list = await api.get(`/grades/${groupId}/student/${studentId}`);
      const found = (list.data.data || []).find((g) => g.date === today);
      if (found) {
        const res = await api.delete(`/grades/${groupId}/${found._id}`);
        if (!res.data.ok) throw new Error(res.data.msg);
      }
      patch(studentId, null);
      return true;
    } catch (error) {
      errorMsg(error.message);
      return false;
    } finally {
      setSaving(null);
    }
  };

  return { today, grades, saving, setGrade, removeGrade };
}
