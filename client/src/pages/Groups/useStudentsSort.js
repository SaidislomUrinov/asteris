import { useEffect, useRef, useState } from "react";
import { api } from "../../utils/fetching";
import usePersistedState from "../../hooks/usePersistedState";
import { useSocketEvent } from "../../hooks/useSocketEvent";

// GroupDetail va Lesson sahifasidagi "O'quvchilar" ro'yxati uchun umumiy
// saralash mantig'i — ikkalasi ham AYNAN bir xil ro'yxatni ko'rsatadi
// (docs/API_CONTRACT_group_students_sort.md).
export const SORT_OPTIONS = [
  { value: "name_asc", labelKey: "group.sortNameAsc" },
  { value: "name_desc", labelKey: "group.sortNameDesc" },
  { value: "grade_desc", labelKey: "group.sortGradeDesc" },
  { value: "grade_asc", labelKey: "group.sortGradeAsc" },
  { value: "attendance_desc", labelKey: "group.sortAttendanceDesc" },
  { value: "attendance_asc", labelKey: "group.sortAttendanceAsc" },
];

// Saralash ishlaydigan tablar: "Umumiy", "Davomat" (oylik matritsa) va
// "Baholar" (+ "Uyga vazifa" matritsasi) — hammasi ham bitta o'quvchilar ro'yxatini ko'rsatadi, shuning
// uchun tanlangan tartib hammasida bir xil bo'lishi kerak.
export const SORTABLE_TABS = ["general", "monthly", "grades", "homework"];
export const isSortableTab = (tab) => SORTABLE_TABS.includes(tab);

/**
 * `/attendance/:groupId/summary` dan har o'quvchi uchun `attendanceRate`
 * (0-100), `gradeAverage` (1-10 yoki `null`) va `gradeScore` (baho SONI
 * hisobga olingan Bayes o'rtachasi — saralash shunga tayanadi) oladi — faqat saralash
 * ko'rinadigan tab (SORTABLE_TABS) ochiq va guruh tanlanganda so'raladi.
 * `month` ("YYYY-MM") — ixtiyoriy; berilmasa server joriy oyni oladi
 * (Guruh detali "Umumiy" tabidagi oy filtri, API_CONTRACT_group_month_filter_and_start_date.md §A.2).
 */
export function useStudentsSummary(groupId, enabled, month) {
  const [summary, setSummary] = useState({});
  // Baho/davomat o'zgarsa (shu yoki boshqa qurilmadan) reyting medallari
  // qayta hisoblanishi uchun xulosa jimgina qayta so'raladi. Ketma-ket
  // hodisalar ("Barchasini kelgan qilish" — N ta attendance:marked) bitta
  // so'rovga jamlanadi.
  const [tick, setTick] = useState(0);
  const timerRef = useRef(null);
  const bump = (p) => {
    if (!enabled || p?.groupId !== groupId) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setTick((n) => n + 1), 400);
  };
  useSocketEvent("grade:set", bump, enabled);
  useSocketEvent("grade:removed", bump, enabled);
  useSocketEvent("attendance:marked", bump, enabled);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  useEffect(() => {
    if (!enabled || !groupId) return;
    let cancelled = false;
    api
      .get(`/attendance/${groupId}/summary`, { params: month ? { month } : undefined })
      .then((res) => {
        if (!cancelled && res.data.ok) setSummary(res.data.data);
      })
      .catch(() => {
        // Jim — saralash shunchaki qo'shimcha imkoniyat, xato bo'lsa ham
        // ro'yxat A-Z bo'yicha (standart) ko'rinishda qolaveradi.
      });
    return () => {
      cancelled = true;
    };
  }, [groupId, enabled, tick, month]);

  return summary;
}

// Barcha sahifalarda BITTA tanlov saqlanadi (foydalanuvchi odatda bitta
// usulda ishlaydi) — sessionStorage, sahifa yangilansa ham yo'qolmaydi.
export function useSortKey() {
  return usePersistedState("groupStudentsSort", "name_asc");
}

// Baho bo'yicha saralash `gradeScore` (soni hisobga olingan) bo'yicha —
// 2 ta "10" olgan o'quvchi 25 ta baho bilan 9.5 o'rtachali o'quvchidan
// yuqoriga chiqmasin (API_CONTRACT_grade_scale10.md §2).
// `gradeScore`/`attendanceRate` yo'q (hali baho/davomat qo'yilmagan)
// o'quvchilar saralash yo'nalishidan qat'iy nazar HAR DOIM ro'yxat
// oxirida — "ma'lumot yo'q"ni "eng past ko'rsatkich" bilan aralashtirmaslik
// uchun.
export function sortStudents(students, sortKey, summary) {
  if (sortKey === "name_desc") {
    return [...students].sort((a, b) => b.fullName.localeCompare(a.fullName, "uz"));
  }
  if (sortKey === "name_asc" || !sortKey) {
    return [...students].sort((a, b) => a.fullName.localeCompare(b.fullName, "uz"));
  }

  const isGrade = sortKey.startsWith("grade");
  const asc = sortKey.endsWith("_asc");
  const valueOf = (s) => {
    const v = isGrade ? summary[s._id]?.gradeScore : summary[s._id]?.attendanceRate;
    return v === undefined || v === null ? null : v;
  };

  return [...students].sort((a, b) => {
    const va = valueOf(a);
    const vb = valueOf(b);
    if (va === null && vb === null) return a.fullName.localeCompare(b.fullName, "uz");
    if (va === null) return 1;
    if (vb === null) return -1;
    return asc ? va - vb : vb - va;
  });
}

/**
 * Guruhdagi haqiqiy baho reytingi: `{ [studentId]: position }` — joriy
 * saralashdan mustaqil. Serverdagi `rankInSummary` bilan AYNAN bir xil
 * qoida (docs/API_CONTRACT_rank_medals.md): `gradeScore` desc, teng bo'lsa
 * `attendanceRate` desc, ikkalasi teng bo'lsa bir xil o'rin (dense rank);
 * bahosi yo'q o'quvchi reytingga kirmaydi. `ids` berilsa faqat shu
 * (faol) o'quvchilar orasida hisoblanadi.
 */
export function computeRanks(summary, ids) {
  const pool = ids ? ids.map((id) => [id, summary[id]]) : Object.entries(summary);
  const rows = pool
    .filter(([, s]) => s && s.gradeScore !== null && s.gradeScore !== undefined)
    .sort(([, a], [, b]) => b.gradeScore - a.gradeScore || (b.attendanceRate || 0) - (a.attendanceRate || 0));
  const ranks = {};
  let rank = 0;
  let prev = null;
  for (const [id, s] of rows) {
    if (!prev || prev.gradeScore !== s.gradeScore || (prev.attendanceRate || 0) !== (s.attendanceRate || 0)) rank++;
    prev = s;
    ranks[id] = rank;
  }
  return ranks;
}
