import { useEffect, useRef, useState } from "react";
import { api } from "../utils/fetching";
import { useSocketEvent } from "./useSocketEvent";
import useFeature from "./useFeature";
import useCan from "./useCan";
import { BADGE_FEATURE } from "../utils/badges";

const EMPTY = { month: null, items: {} };

/**
 * Guruh ro'yxatidagi mini nishonlar uchun (`GET /badges/group/:groupId`,
 * default — o'tgan oy). GroupDetail va /lesson sahifasida umumiy.
 * Tarif flagi (`gamification.badges`) yoki `group:view` bo'lmasa API
 * umuman chaqirilmaydi. `badge:awarded` socket eventida jimgina qayta so'raladi.
 *
 * @returns {{ month: string|null, items: Record<string, string[]> }}
 */
export default function useGroupBadges(groupId) {
  const hasFeature = useFeature();
  const can = useCan();
  // Backend `/badges/group/:id` bilan bir xil: `group:view` YOKI `attendance:view`
  // (o'qituvchi /lesson sahifasida `group:view`siz bo'lishi mumkin).
  const enabled = !!groupId && hasFeature(BADGE_FEATURE) && (can("group:view") || can("attendance:view"));

  const [data, setData] = useState(EMPTY);
  const [tick, setTick] = useState(0);
  const timerRef = useRef(null);

  useSocketEvent(
    "badge:awarded",
    (payload) => {
      if (payload?.groupId && payload.groupId !== groupId) return;
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setTick((n) => n + 1), 400);
    },
    enabled,
  );
  useEffect(() => () => clearTimeout(timerRef.current), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await api.get(`/badges/group/${groupId}`);
        if (!cancelled && res.data.ok) setData({
            groupId,
            month: res.data.data?.month || null,
            items: res.data.data?.items || {},
          });
      } catch {
        // Jim — nishonlar qo'shimcha bezak, xato bo'lsa ro'yxat ularsiz qoladi.
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [groupId, enabled, tick]);

  // Guruh almashganda eski guruh nishonlari bir lahza ham ko'rinmasin.
  return enabled && data.groupId === groupId ? data : EMPTY;
}
