import { useCallback, useEffect, useRef, useState } from "react";

// Sahifa darajasidagi yuklash holati: { data, loading, error, reload }.
// `fn` o'zgarsa qayta yuklaydi (deps orqali memoize qiling).
export const useRequest = (fn, deps = [], { enabled = true } = {}) => {
  const [state, setState] = useState({ data: null, loading: enabled, error: null });
  const seq = useRef(0);

  const run = useCallback(async (silent = false) => {
    const id = ++seq.current;
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fn();
      if (id === seq.current) setState({ data, loading: false, error: null });
    } catch (e) {
      if (id === seq.current) setState((s) => ({ ...s, loading: false, error: e }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (enabled) run();
  }, [run, enabled]);

  // Socket payload'ini refetchsiz joyida qo'llash (`useScopedLive` `patch`).
  const mutate = useCallback((updater) => {
    setState((s) => (s.data == null ? s : { ...s, data: updater(s.data) }));
  }, []);

  return { ...state, reload: run, mutate };
};
