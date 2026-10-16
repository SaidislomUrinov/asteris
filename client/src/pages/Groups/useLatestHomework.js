import { useCallback, useEffect, useState } from "react";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { api } from "../../utils/fetching";

/**
 * Guruh detalidagi "Oxirgi vazifa" kartasi ma'lumoti
 * (docs/API_CONTRACT_group_latest_homework.md).
 *
 * GroupDetail darajasida, guruh so'rovi bilan PARALLEL chaqiriladi: avval
 * karta o'zi so'rov yuborardi — u esa guruh yuklangandan keyingina mount
 * bo'lib, o'quvchilar/davomat/lookup so'rovlari navbatining oxirida qolardi,
 * natijada karta hamma narsadan keyin paydo bo'lardi.
 * Boshqa xodim vazifa yozsa yoki natija qo'ysa (`homework:updated|results`)
 * qayta so'raladi.
 *
 * @param {string} groupId
 * @param {boolean} enabled - vazifa tabiga ruxsat + tarif flagi
 * @returns {{ item: Object|null, loaded: boolean }}
 */
export default function useLatestHomework(groupId, enabled) {
  const [item, setItem] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!groupId || !enabled) return;
    try {
      const { data } = await api.get(`/homework/${groupId}/latest`);
      if (!data.ok) throw new Error(data.msg);
      setItem(data.data?.item || null);
    } catch {
      // Ikkinchi darajali karta — xato bo'lsa jim bo'sh ko'rsatiladi.
      setItem(null);
    } finally {
      setLoaded(true);
    }
  }, [groupId, enabled]);

  useEffect(() => {
    const id = setTimeout(load, 0);
    return () => clearTimeout(id);
  }, [load]);

  const onChanged = useCallback(
    (p) => {
      if (p?.groupId === groupId) load();
    },
    [groupId, load],
  );
  useSocketEvent("homework:updated", onChanged, !!groupId && enabled);
  useSocketEvent("homework:results", onChanged, !!groupId && enabled);

  return { item, loaded };
}
