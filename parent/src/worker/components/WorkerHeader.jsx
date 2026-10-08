import { useTranslation } from "react-i18next";
import { useWorker } from "../useWorker";
import { RoleBadge } from "./RoleBadge";
import { HeaderActions } from "./HeaderActions";

// Bosh ekran sarlavhasi: rol belgisi + katta sarlavha + qidiruv/qo'ng'iroqcha.
export const WorkerHeader = ({ title }) => {
  const { t } = useTranslation();
  const { me, role, roleColor, isOwner, centerId } = useWorker();
  const centerName = isOwner
    ? (me?.centers || []).find((c) => c._id === centerId)?.name || me?.client?.name
    : me?.center?.name;
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <RoleBadge color={roleColor}>
          {t(`worker.role.${role}`)}
          {centerName ? ` · ${centerName}` : ""}
        </RoleBadge>
        <h1 className="text-[22px] font-extrabold leading-tight tracking-tight text-ink break-words">{title}</h1>
      </div>
      <HeaderActions />
    </header>
  );
};
