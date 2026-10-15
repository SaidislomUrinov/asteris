import { useEffect, useState } from "react";
import { api } from "../utils/fetching";
import useFeature from "./useFeature";

/**
 * WECOIN ishlayotgan filiallar (GET /coins/active-centers,
 * docs/API_CONTRACT_individual_coins.md §3). Tarifda `gamification.coins`
 * bo'lmasa so'rov yuborilmaydi va bo'sh to'plam qaytadi.
 *
 * @returns {{ ready: boolean, has: (centerId: string) => boolean }}
 */
export default function useCoinCenters() {
  const hasFeature = useFeature();
  const enabled = hasFeature("gamification.coins");
  const [centers, setCenters] = useState(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    (async () => {
      try {
        const res = await api.get("/coins/active-centers");
        if (alive) setCenters(res.data?.ok ? res.data.data.centers : []);
      } catch {
        if (alive) setCenters([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [enabled]);

  return {
    ready: !enabled || centers !== null,
    has: (centerId) => enabled && !!centerId && (centers || []).includes(String(centerId)),
  };
}
