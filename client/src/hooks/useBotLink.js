import { useEffect, useState } from "react";
import { api } from "../utils/fetching";

// O'quvchi/ota-ona botining havolasi (GET /telegram/bot). Bot nomi sessiya
// davomida o'zgarmaydi — bir marta so'raladi, keyin modul keshidan olinadi.
let cache = null;
let pending = null;

const load = async () => {
  if (cache) return cache;
  if (!pending) {
    pending = (async () => {
      try {
        const res = await api.get("/telegram/bot");
        cache = res.data?.ok ? res.data.data : null;
      } catch {
        cache = null;
      } finally {
        pending = null;
      }
      return cache;
    })();
  }
  return pending;
};

/** @returns {{ username: string, link: string } | null} bot sozlanmagan bo'lsa null */
export default function useBotLink() {
  const [info, setInfo] = useState(cache);
  useEffect(() => {
    if (cache) return;
    let alive = true;
    (async () => {
      const data = await load();
      if (alive) setInfo(data);
    })();
    return () => {
      alive = false;
    };
  }, []);
  return info?.link ? info : null;
}
