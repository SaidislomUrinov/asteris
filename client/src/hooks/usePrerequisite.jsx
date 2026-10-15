import { useCallback } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import useCan from "./useCan";

// Old shartlar: nima yetishmasa — qaysi sahifada qo'shiladi va kim qo'sha oladi.
const PREREQS = {
  center: { path: "/centers", ownerOnly: true },
  subject: { path: "/subjects", permission: "subject:create" },
  group: { path: "/groups", permission: "group:create", noTeaching: true },
};

/**
 * Kerakli narsa (filial, fan, guruh) hali yo'q bo'lsa: "Avval <fan> qo'shing"
 * xabari, nom — havola (blue-500, tagiga chiziq). Bosilganda o'sha sahifaga
 * `?create=1` bilan o'tadi va qo'shish oynasi o'zi ochiladi
 * (hooks/useCreateFromQuery.js). Qo'sha olmaydigan foydalanuvchiga havola
 * o'rniga "rahbarga murojaat qiling".
 *
 * @returns {(kind: "center" | "subject" | "group") => void}
 */
export default function usePrerequisite() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const can = useCan();
  const { authType, role } = useSelector((e) => e.user);

  return useCallback(
    (kind) => {
      const p = PREREQS[kind];
      if (!p) return;
      const isTeaching = authType === "staff" && ["teacher", "assistant"].includes(role);
      const allowed = p.ownerOnly
        ? authType === "owner"
        : can(p.permission) && !(p.noTeaching && isTeaching);
      const name = t(`prereq.${kind}`);
      const id = `prereq:${kind}`;

      if (!allowed) {
        toast.warning(t("prereq.askOwner", { name }), { id });
        return;
      }
      // Tarjima {{name}} joyidan bo'linadi — har tilda so'z tartibi o'zi saqlanadi
      // ("Avval fan qo'shing" / "Сначала добавьте предмет").
      const MARK = "\u0000";
      const [before = "", after = ""] = t("prereq.message", { name: MARK }).split(MARK);
      // Xato emas, keyingi qadam — qizil emas, ogohlantirish (amber) ikonkasi.
      toast.warning(
        <span>
          {before}
          <button
            type="button"
            onClick={() => {
              toast.dismiss(id);
              navigate(`${p.path}?create=1`);
            }}
            className="font-semibold text-blue-500 dark:text-blue-400 underline underline-offset-2 decoration-blue-500/60 dark:decoration-blue-400/60 hover:decoration-current cursor-pointer"
          >
            {name}
          </button>
          {after}
        </span>,
        { id, duration: 8000 },
      );
    },
    [t, navigate, can, authType, role],
  );
}
