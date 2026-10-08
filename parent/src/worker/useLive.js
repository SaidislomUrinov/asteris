import { useEffect, useRef } from "react";
import { useRequest } from "../hooks/useRequest";
import { useWorker } from "./useWorker";

// useRequest + jonli yangilanish: socket eventlari (debounce'langan `tick`)
// kelganda ma'lumot skeleton'siz (silent) qayta yuklanadi.
export const useLive = (fn, deps = [], opts) => {
  const { tick } = useWorker();
  const req = useRequest(fn, deps, opts);
  const { reload } = req;
  const first = useRef(tick);
  useEffect(() => {
    if (tick === first.current) return;
    reload(true);
  }, [tick, reload]);
  return req;
};
