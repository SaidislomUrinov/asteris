import { useEffect, useRef } from "react";
import { useRequest } from "../hooks/useRequest";
import { useWorker } from "./useWorker";
import { useSocketEvents } from "./useSocket";
import { LIVE_DEBOUNCE_MS } from "./constants";

// useRequest + FAQAT shu sahifaga tegishli socket eventlari (details §5):
// `match(event, payload)` true bo'lsa ≈800ms debounce bilan skeleton'siz
// qayta yuklanadi. Qayta ulanganda ham bir marta yangilanadi (o'tkazib
// yuborilgan eventlar o'rniga).
export const useScopedLive = (fn, deps = [], { events = [], match, enabled = true } = {}) => {
  const { connected } = useWorker();
  const req = useRequest(fn, deps, { enabled });
  const { reload } = req;
  const timer = useRef(null);

  const schedule = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => reload(true), LIVE_DEBOUNCE_MS);
  };

  useSocketEvents(events, (ev, payload) => {
    if (!enabled) return;
    if (!match || match(ev, payload)) schedule();
  });

  const wasConnected = useRef(connected);
  useEffect(() => {
    if (connected && !wasConnected.current && enabled) reload(true);
    wasConnected.current = connected;
  }, [connected, enabled, reload]);

  useEffect(() => () => clearTimeout(timer.current), []);
  return req;
};
