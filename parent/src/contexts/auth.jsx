import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import i18n from "../i18n";
import { authTelegram, getMe } from "../api/parent";
import { getToken, setToken, ROLE_MISMATCH_EVENT } from "../api/http";
import { getInitData } from "../lib/telegram";

const AuthCtx = createContext(null);

// status: "loading" | "ready" | "notLinked" | "error"
export const AuthProvider = ({ children }) => {
  const [status, setStatus] = useState("loading");
  const [parent, setParent] = useState(null);
  const [error, setError] = useState(null);

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
        setToken(res.access);
        p = res.parent;
      }
      applyParent(p);
      setStatus("ready");
    } catch (e) {
      setToken(null);
      if (e.code === "parent.notLinked" || e.code === "parent.noTelegram") setStatus("notLinked");
      else {
        setError(e);
        setStatus("error");
      }
    }
  }, [applyParent]);

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

  const logout = useCallback(() => {
    setToken(null);
    setParent(null);
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
    }),
    [status, parent, error, login, logout, applyParent, role, availableRoles],
  );
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthCtx);
