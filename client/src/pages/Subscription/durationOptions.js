import { useEffect, useState } from "react";
import { api } from "../../utils/fetching";

// Obuna muddati chegirmalari Admin paneldan sozlanadi
// (docs/API_CONTRACT_tariff_discounts.md) — `GET /tariffs/discounts`.
// Server summani o'zi qayta hisoblaydi; bu yerda faqat ko'rsatish uchun.

/** `percent` — 0..90 (foiz). */
export const calcAmount = (monthlyPrice, months, percent) =>
  Math.round(monthlyPrice * months * (1 - (percent || 0) / 100));

/** "3 oy" / "1 yil" — 12 ga karrali muddat yilda. */
export const durationLabel = (t, months) =>
  months % 12 === 0
    ? t("subscription.durationLabels.years", { count: months / 12 })
    : t("subscription.durationLabels.months", { count: months });

/**
 * @param {boolean} enabled - oyna ochiq bo'lganda so'raladi
 * @returns {{ options: {months: number, percent: number}[], loading: boolean }}
 */
export function useDurationOptions(enabled) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    const run = async () => {
      try {
        setLoading(true);
        const res = await api.get("/tariffs/discounts");
        if (!res.data.ok) throw new Error(res.data.msg);
        if (alive) setOptions(res.data.data?.items || []);
      } catch {
        // Xato bo'lsa — faqat 1 oylik (chegirmasiz) variant; server baribir tekshiradi.
        if (alive) setOptions([{ months: 1, percent: 0 }]);
      } finally {
        if (alive) setLoading(false);
      }
    };
    const id = setTimeout(run, 0);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [enabled]);

  return { options, loading };
}
