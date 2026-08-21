import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { api } from "../../utils/fetching";

const JS_DAY_TO_CODE = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export const dateKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

// Sana → dars mavzusi moslashuvining YAGONA manbai. Avval bu mantiq
// LessonCalendar ichida yashirin edi; "Bugungi dars" kartochkasi ham xuddi
// shu hisobga muhtoj bo'lgach, ikki nusxa saqlash o'rniga hookga chiqarildi
// (ikki joyda ikki xil natija chiqishi eng yomon xato bo'lardi).
//
// Qoida (API_CONTRACT_syllabus.md §3): darslar `activatedAt` dan boshlab,
// guruhning haftalik kunlari bo'yicha, dam olish deb belgilangan kunlarni
// tashlab ketma-ket taqsimlanadi:
//     dars kunlari ro'yxatining k-indeksi  ↔  lessons[k + lessonOffset]
// Dastur tugagach kunlar qoladi, lekin mavzu `null` bo'ladi —
// "Mavzu biriktirilmagan".
//
// `enabled` — kurs dasturi so'ralsinmi (faqat o'qituvchi/yordamchi uchun).
// Dam olish kunlari esa HAR DOIM yuklanadi: ular Boshliq ko'radigan
// kalendarga ham kerak.
export function useLessonSchedule({
  groupId,
  days = [],
  status,
  activatedAt,
  finishedAt,
  enabled = false,
}) {
  const [lessons, setLessons] = useState([]);
  const [lessonOffset, setLessonOffset] = useState(0);
  const [holidays, setHolidays] = useState({}); // { "YYYY-MM-DD": { chargeable, note } }
  // Qaysi sanagacha hisoblanadi. Kalendar oyni oldinga surganda `extendTo`
  // orqali o'sadi; boshlang'ich qiymat — keyingi oyning oxiri, ya'ni
  // "keyingi dars" ni topish uchun har doim yetarli zaxira bor.
  const [horizon, setHorizon] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 2, 0);
  });
  const fetchedMonths = useRef(new Set());

  const fetchSyllabus = useCallback(async () => {
    if (!groupId || !enabled) return;
    try {
      const res = await api.get(`/syllabus/${groupId}`);
      const { ok, data } = res.data;
      if (!ok) return;
      const flat = [];
      for (const m of data?.modules || []) {
        for (const l of m.lessons || []) {
          flat.push({ ...l, moduleTitle: m.title, no: flat.length + 1 });
        }
      }
      setLessons(flat);
      setLessonOffset(data?.lessonOffset || 0);
    } catch {
      // jim o'tkazamiz — kalendar dastursiz ham ishlaydi
    }
  }, [groupId, enabled]);

  const fetchHolidayMonth = useCallback(
    async (month, force = false) => {
      if (!groupId) return;
      if (!force && fetchedMonths.current.has(month)) return;
      fetchedMonths.current.add(month);
      try {
        const res = await api.get(`/group-holidays/${groupId}`, { params: { month } });
        const { ok, data } = res.data;
        if (!ok) return;
        setHolidays((prev) => {
          // Shu oyning eski yozuvlari almashtiriladi, boshqa oylar qoladi:
          // moslashuv darslar boshlangan sanadan beri sanalgani uchun
          // oraliqdagi BARCHA oylarning dam olish kunlari kerak.
          const next = Object.fromEntries(
            Object.entries(prev).filter(([date]) => !date.startsWith(`${month}-`)),
          );
          for (const h of data) next[h.date] = h;
          return next;
        });
      } catch {
        // jim o'tkazamiz
      }
    },
    [groupId],
  );

  // Darslar boshlangan oydan `horizon` oyigacha bo'lgan barcha oylar.
  const fetchHolidays = useCallback(async () => {
    if (!groupId) return;
    const months = [];
    const startDate = activatedAt ? new Date(activatedAt * 1000) : new Date();
    const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const limit = new Date(horizon.getFullYear(), horizon.getMonth(), 1);
    while (cursor <= limit && months.length < 36) {
      months.push(monthKey(cursor));
      cursor.setMonth(cursor.getMonth() + 1);
    }
    await Promise.all(months.map((m) => fetchHolidayMonth(m)));
  }, [groupId, activatedAt, horizon, fetchHolidayMonth]);

  useEffect(() => {
    // setTimeout — `react-hooks/set-state-in-effect` (loyihadagi mavjud
    // naqsh): so'rov effekt tanasidan tashqariga chiqariladi.
    const id = setTimeout(fetchHolidays, 0);
    return () => clearTimeout(id);
  }, [fetchHolidays]);

  useEffect(() => {
    const id = setTimeout(fetchSyllabus, 0);
    return () => clearTimeout(id);
  }, [fetchSyllabus]);

  useSocketEvent("syllabus:changed", (p) => {
    if (p?.groupId === groupId && enabled) fetchSyllabus();
  });

  // Kalendar ko'rilayotgan oyni oldinga surganda chaqiriladi.
  const extendTo = useCallback((date) => {
    setHorizon((prev) => (date > prev ? new Date(date) : prev));
  }, []);

  const lessonByDate = useMemo(() => {
    if (!activatedAt || status === "pending") return {};
    const map = {};
    let index = lessonOffset;
    const start = new Date(activatedAt * 1000);
    const finishKey = finishedAt ? dateKey(new Date(finishedAt * 1000)) : null;
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    while (cursor <= horizon) {
      const key = dateKey(cursor);
      const isLessonWeekday = days.includes(JS_DAY_TO_CODE[cursor.getDay()]);
      const isHoliday = !!holidays[key];
      const afterFinish = finishKey && key > finishKey;
      if (isLessonWeekday && !isHoliday && !afterFinish) {
        map[key] = lessons[index] || null; // null → "Mavzu biriktirilmagan"
        index += 1;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return map;
  }, [activatedAt, status, finishedAt, days, holidays, lessons, lessonOffset, horizon]);

  // Bugungi va keyingi dars — kartochka uchun. `lesson: null` ham to'liq
  // haqiqiy javob: dars bor, ammo mavzu biriktirilmagan.
  const { todayLesson, nextLesson } = useMemo(() => {
    const todayKey = dateKey(new Date());
    const keys = Object.keys(lessonByDate).sort();
    const today = keys.includes(todayKey)
      ? { date: todayKey, lesson: lessonByDate[todayKey] }
      : null;
    const nextKey = keys.find((k) => k > todayKey);
    return {
      todayLesson: today,
      nextLesson: nextKey ? { date: nextKey, lesson: lessonByDate[nextKey] } : null,
    };
  }, [lessonByDate]);

  return {
    lessons,
    lessonOffset,
    holidays,
    lessonByDate,
    todayLesson,
    nextLesson,
    extendTo,
    refetchMonth: (month) => fetchHolidayMonth(month, true),
  };
}
