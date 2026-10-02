import { useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * `useState` bilan bir xil interfeys, lekin qiymat URL query-param'da yashaydi
 * (`/students?search=ali&page=2`).
 *
 * Nega sessionStorage emas: ro'yxat sahifasidan Detail'ga kirib "Orqaga"
 * qaytilganda filtr saqlanib qolishi kerak — URL buni tabiiy hal qiladi
 * (brauzer tarixi), ustiga-ustak havolani nusxalab ulashish/yangilash ham
 * ishlaydi va yashirin "yopishib qolgan" filtr muammosi yo'qoladi: URL'da
 * nima bo'lsa, ekranda shu.
 *
 * Boshlang'ich qiymatga teng bo'lgan param URL'dan o'chiriladi — manzil
 * toza qoladi (`?page=1&search=` kabi chiqindi bo'lmaydi).
 *
 * Bir tick ichida bir nechta setter chaqirilsa ham (`setPage(1); setSearch(v)`)
 * hammasi saqlanadi — setter har safar `window.location.search`dan o'qiydi,
 * eskirgan closure'dan emas.
 *
 * Tur `initialValue`dan aniqlanadi: number → Number, array → vergul bilan
 * ajratilgan ro'yxat, aks holda satr.
 */
const serialize = (value, initialValue) => {
  if (Array.isArray(initialValue)) return value.length ? value.join(",") : null;
  if (value === initialValue || value === "" || value === null || value === undefined) return null;
  return String(value);
};

const parse = (raw, initialValue) => {
  if (raw === null) return initialValue;
  if (Array.isArray(initialValue)) return raw ? raw.split(",") : [];
  if (typeof initialValue === "number") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : initialValue;
  }
  return raw;
};

export default function useQueryState(key, initialValue) {
  const location = useLocation();
  const navigate = useNavigate();

  // Qiymat XOM SATRGA bog'lab memoize qilinadi — massiv turida `split`
  // har renderda yangi reference berib, `useCallback`/`useEffect`
  // dep'larini o'zgartirar va ro'yxat cheksiz qayta fetch bo'lar edi.
  const raw = new URLSearchParams(location.search).get(key);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(() => parse(raw, initialValue), [raw]);

  const setValue = useCallback(
    (next) => {
      const params = new URLSearchParams(window.location.search);
      const prev = parse(params.get(key), initialValue);
      const resolved = typeof next === "function" ? next(prev) : next;
      const s = serialize(resolved, initialValue);
      if (s === null) params.delete(key);
      else params.set(key, s);
      const search = params.toString();
      // `replace` — har harf terilganda tarixga yangi yozuv tushmasin,
      // "Orqaga" bitta bosishda oldingi sahifaga qaytsin.
      navigate({ pathname: window.location.pathname, search: search ? `?${search}` : "" }, { replace: true });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, navigate],
  );

  return [value, setValue];
}

/**
 * Bir nechta kalitni BITTA obyekt sifatida URL'da saqlaydi — `useState({...})`
 * bilan bir xil interfeys (`setState(partialOrFull | fn)`), lekin har bir
 * maydon o'z query-param'ida (`?from=2026-09-01&to=2026-09-21`). Bitta
 * `navigate` chaqiruvi — hammasi bir yo'la yoziladi. `defaults` obyekti
 * hech qachon o'zgarmasligi kerak (modul darajasidagi const).
 */
export function useQueryStates(defaults) {
  const location = useLocation();
  const navigate = useNavigate();
  const keys = Object.keys(defaults);

  const params = new URLSearchParams(location.search);
  const rawKey = keys.map((k) => `${k}=${params.get(k) ?? ""}`).join("&");
  const value = useMemo(
    () => Object.fromEntries(keys.map((k) => [k, parse(params.get(k), defaults[k])])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawKey],
  );

  const setValue = useCallback(
    (next) => {
      const p = new URLSearchParams(window.location.search);
      const prev = Object.fromEntries(keys.map((k) => [k, parse(p.get(k), defaults[k])]));
      const resolved = typeof next === "function" ? next(prev) : { ...prev, ...next };
      for (const k of keys) {
        const s = serialize(resolved[k] ?? defaults[k], defaults[k]);
        if (s === null) p.delete(k);
        else p.set(k, s);
      }
      const search = p.toString();
      navigate({ pathname: window.location.pathname, search: search ? `?${search}` : "" }, { replace: true });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigate],
  );

  return [value, setValue];
}
