import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/auth";

// Rolga mos matn: o'quvchi rolida `student.<key>` bo'lsa o'sha ("Farzandingiz" →
// "Siz"), aks holda oddiy `<key>`. Ota-ona rolida hech narsa o'zgarmaydi.
export const useRoleT = () => {
  const { t, i18n } = useTranslation();
  const { isStudent } = useAuth();
  return useCallback(
    (key, opts) => (isStudent && i18n.exists(`student.${key}`) ? t(`student.${key}`, opts) : t(key, opts)),
    [t, i18n, isStudent],
  );
};
