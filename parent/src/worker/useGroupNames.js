import { useEffect, useState } from "react";
import { workerApi } from "./api";
import { groupLabel } from "./utils";

// O'quvchi a'zoliklarida (`Student.groups[].group`) faqat guruh id'si bor —
// nomlar `/groups` (1-sahifa) dan, topilmaganlari `/groups/:id` dan olinadi.
const cache = new Map();

export const useGroupNames = (ids = []) => {
  const [, force] = useState(0);
  const key = [...new Set(ids.filter(Boolean).map(String))].sort().join(",");

  useEffect(() => {
    const want = key ? key.split(",") : [];
    const missing = want.filter((id) => !cache.has(id));
    if (!missing.length) return undefined;
    let alive = true;
    (async () => {
      try {
        if (cache.size === 0) {
          const res = await workerApi.groups();
          (res?.data || res || []).forEach((g) => cache.set(String(g._id), groupLabel(g)));
        }
        const still = missing.filter((id) => !cache.has(id));
        await Promise.allSettled(
          still.map(async (id) => {
            const g = await workerApi.group(id);
            cache.set(id, groupLabel(g));
          }),
        );
      } catch {
        /* nom topilmasa "—" ko'rinadi */
      } finally {
        if (alive) force((n) => n + 1);
      }
    })();
    return () => {
      alive = false;
    };
  }, [key]);

  return (id) => (id && cache.get(String(id))) || "—";
};
