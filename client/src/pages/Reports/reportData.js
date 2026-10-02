import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../utils/fetching";
import { errorMsg } from "../../utils/alert";

// Hisobot tablarida takrorlanadigan ma'lumot olish va saralash mantiqi.
// Komponentlardan alohida fayl — aks holda Vite'ning fast-refresh'i
// buziladi (`react-refresh/only-export-components`).

export const money = (v) => `${Math.round(v || 0).toLocaleString("uz-UZ")}`;

// O'sish foizi. `null`/`undefined` bo'lsa taqqoslash uchun oldingi davr
// ma'lumoti yo'q degani — chaqiruvchi uni umuman ko'rsatmaydi.
export const percent = (v) => `${v > 0 ? "+" : ""}${Math.round(v || 0)}%`;

/**
 * Hisobot endpointidan ma'lumot oladi.
 *
 * @param {string} endpoint - masalan "/reports/by-center"
 * @param {Object} params - so'rov query'si
 * @param {Array} [deps] - so'rovga kirmaydigan, lekin qayta yuklashni
 *   talab qiladigan qiymatlar (realtime "tick" kabi)
 */
export function useReportResource(endpoint, params, deps = []) {
  const [state, setState] = useState({ data: null, extra: {}, loading: true, error: false });

  // Obyekt har renderda yangi havola bo'ladi — solishtirish uchun
  // barqaror kalitga aylantiriladi, aks holda so'rov cheksiz takrorlanardi.
  const key = JSON.stringify(params);
  const depsKey = JSON.stringify(deps);

  const fetchData = useCallback(async () => {
    // Bo'sh endpoint — so'rov o'chirilgan (masalan tarifda bu hisobot yo'q).
    if (!endpoint) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    try {
      setState((s) => ({ ...s, loading: true, error: false }));
      const res = await api.get(endpoint, { params: JSON.parse(key) });
      const { ok, data, msg, ...rest } = res.data;
      if (!ok) throw new Error(msg);
      setState({ data: data ?? null, extra: rest || {}, loading: false, error: false });
    } catch (error) {
      setState((s) => ({ ...s, loading: false, error: true }));
      errorMsg(error.message);
    }
  }, [endpoint, key]);

  useEffect(() => {
    // `depsKey` chaqiruvda ishlatilmaydi — u faqat tashqi qayta yuklash
    // signali (socket tick) bo'lgani uchun bog'liqlikda turadi.
    const id = setTimeout(fetchData, 0);
    return () => clearTimeout(id);
  }, [fetchData, depsKey]);

  return { ...state, refetch: fetchData };
}

const valueAt = (row, path) => path.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), row);

/**
 * Jadval ustunlari bo'yicha mijoz tomonda saralash. Hisobot qatorlari
 * ko'pi bilan bir necha o'nlab bo'lgani uchun server tomon sort ortiqcha.
 */
export function useSorted(rows, initialKey = "", initialDir = "desc") {
  const [sort, setSort] = useState({ key: initialKey, dir: initialDir });

  const sorted = useMemo(() => {
    const list = Array.isArray(rows) ? [...rows] : [];
    if (!sort.key) return list;
    const sign = sort.dir === "asc" ? 1 : -1;
    return list.sort((a, b) => {
      const av = valueAt(a, sort.key);
      const bv = valueAt(b, sort.key);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * sign;
      return String(av ?? "").localeCompare(String(bv ?? ""), "uz") * sign;
    });
  }, [rows, sort]);

  const toggle = (key) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" },
    );

  return { rows: sorted, sort, toggle };
}
