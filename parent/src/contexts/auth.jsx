import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import i18n from "../i18n";
import { authTelegram, getMe } from "../api/parent";
import { getToken, setToken, ROLE_MISMATCH_EVENT } from "../api/http";
import { getInitData } from "../lib/telegram";
import {
  workerApi, getWorkerToken, setWorkerSession, clearWorkerSession, isWorkerKind, WORKER_SESSION_LOST,
  restoreWorkerCenter,
} from "../worker/api";

const AuthCtx = createContext(null);

// status: "loading" | "ready" | "notLinked" | "error"
// mode: "parent" (ota-ona/o'quvchi — eski Shell) | "worker" (Boshliq/Hodim —
// WorkerApp, docs/API_CONTRACT_worker_webapp.md §1, §5)
export const AuthProvider = ({ children }) => {
  const [status, setStatus] = useState("loading");
  const [parent, setParent] = useState(null);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState("parent");
  const [worker, setWorker] = useState(null);

  const enterWorker = useCallback((w) => {
    setToken(null);
    setParent(null);
    setWorker(w);
    if (w?.lang && w.lang !== i18n.language) i18n.changeLanguage(w.lang);
    setMode("worker");
    setStatus("ready");
  }, []);

  const applyParent = useCallback((p) => {
    setParent(p);
    if (p?.lang && p.lang !== i18n.language) i18n.changeLanguage(p.lang);
  }, []);

  const login = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const initData = getInitData();
      let p;
      // Brauzer sinovi: sessiyada ishchi tokeni bor — /worker/me bilan tiklaymiz.
      if (getWorkerToken() && !initData) {
        try {
          enterWorker(await workerApi.me());
          return;
        } catch {
          clearWorkerSession();
        }
      }
      if (getToken() && !initData) {
        // Brauzer sinovi: sessiyada token bor — qayta login shart emas
        try {
          p = await getMe();
        } catch {
          setToken(null);
        }
      }
      if (!p) {
        if (!initData) throw Object.assign(new Error("parent.noTelegram"), { code: "parent.noTelegram" });
        const res = await authTelegram(initData);
        // Ustuvorlik serverda: Client > Staff > Ota-ona (§0). `kind` yo'q —
        // eski server, ota-ona oqimi o'zgarishsiz.
        if (isWorkerKind(res?.kind)) {
          setWorkerSession(res.access, res.kind);
          let w = res.worker || (await workerApi.me());
          // Ko'p filialli hodim: oxirgi tanlangan filial (Telegram CloudStorage).
          // Login javobi asosiy filial bilan keladi — boshqa filial saqlangan
          // bo'lsa `me` shu filial bilan qayta olinadi (server tekshiradi).
          if (res.kind === "staff" && (w?.centers?.length || 0) > 1) {
            const saved = await restoreWorkerCenter(w._id);
            if (saved && saved !== w.center?._id) w = await workerApi.me().catch(() => w);
          }
          enterWorker(w);
          return;
        }
        clearWorkerSession();
        setToken(res.access);
        p = res.parent;
      }
      applyParent(p);
      setMode("parent");
      setStatus("ready");
    } catch (e) {
      setToken(null);
      clearWorkerSession();
      setWorker(null);
      if (e.code === "parent.notLinked" || e.code === "parent.noTelegram") setStatus("notLinked");
      else {
        setError(e);
        setStatus("error");
      }
    }
  }, [applyParent, enterWorker]);

  useEffect(() => {
    const id = setTimeout(login, 0);
    return () => clearTimeout(id);
  }, [login]);

  // Rol boshqa joyda (bot /role) almashtirilgan bo'lsa server 403 qaytaradi —
  // xabar ko'rsatib, /me ni qayta o'qiymiz (role o'zgarsa Shell qayta yuklanadi).
  useEffect(() => {
    const onMismatch = async (ev) => {
      const code = ev.detail?.code;
      toast.error(i18n.t(code, { defaultValue: i18n.t("error.unknown") }), { id: "role-mismatch" });
      try {
        applyParent(await getMe());
      } catch {
        /* keyingi so'rovda qayta urinadi */
      }
    };
    window.addEventListener(ROLE_MISMATCH_EVENT, onMismatch);
    return () => window.removeEventListener(ROLE_MISMATCH_EVENT, onMismatch);
  }, [applyParent]);

  // Ishchi sessiyasi qayta kirish bilan ham tiklanmadi — xato ekrani
  // ("Qayta urinish" → login).
  useEffect(() => {
    const onLost = () => {
      clearWorkerSession();
      setWorker(null);
      setError(Object.assign(new Error("auth.failed"), { code: "auth.failed" }));
      setStatus("error");
    };
    window.addEventListener(WORKER_SESSION_LOST, onLost);
    return () => window.removeEventListener(WORKER_SESSION_LOST, onLost);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    clearWorkerSession();
    setParent(null);
    setWorker(null);
    setMode("parent");
    setStatus("notLinked");
  }, []);

  // role: "parent" | "student" (server effectiveRole). Eski server javobida
  // role bo'lmasa — ota-ona.
  const role = parent?.role === "student" ? "student" : "parent";
  const availableRoles = useMemo(
    () => (parent?.availableRoles?.length ? parent.availableRoles : [role]),
    [parent, role],
  );
  const value = useMemo(
    () => ({
      status, parent, error, login, logout, setParent: applyParent,
      role, isStudent: role === "student", availableRoles,
      mode, worker, isWorker: mode === "worker",
    }),
    [status, parent, error, login, logout, applyParent, role, availableRoles, mode, worker],
  );
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthCtx);
