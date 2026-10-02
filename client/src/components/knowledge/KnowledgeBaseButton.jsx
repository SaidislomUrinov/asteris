import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { HiQuestionMarkCircle } from "react-icons/hi2";
import KnowledgeBaseModal from "./KnowledgeBaseModal";
import { resolveKnowledgeKey } from "../../knowledge";

// Top panel "?" tugmasi — joriy sahifaga mos Bilimlar bazasi maqolasini
// modalda ochadi. Maqolasi yo'q manzilda tugma umuman ko'rinmaydi.
export default function KnowledgeBaseButton({ titleKey }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { authType, role } = useSelector((e) => e.user);
  const [open, setOpen] = useState(false);

  const articleKey = resolveKnowledgeKey(pathname, { authType, role });
  if (!articleKey) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={t("kb.open")}
        aria-label={t("kb.open")}
        className="relative flex items-center justify-center w-9 h-9 rounded-lg text-white/70 hover:bg-white/10 hover:text-white cursor-pointer transition-colors"
      >
        <HiQuestionMarkCircle size={18} />
      </button>
      <KnowledgeBaseModal
        open={open}
        onClose={() => setOpen(false)}
        articleKey={articleKey}
        titleKey={titleKey}
      />
    </>
  );
}
