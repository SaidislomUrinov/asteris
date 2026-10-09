import { useTranslation } from "react-i18next";
import { HiOutlineBuildingOffice2, HiOutlineArrowRightOnRectangle } from "react-icons/hi2";
import { WorkerPage } from "../components/WorkerPage";
import { Card, KV, SectionLabel } from "../../components/Card";
import { Button } from "../../components/Button";
import { initials } from "../../utils/format";
import { closeApp } from "../../lib/telegram";
import { useWorker } from "../useWorker";
import { RoleBadge } from "../components/RoleBadge";
import { ReadOnlyNote } from "../components/ReadOnlyNote";

// Profil: kim, qaysi tashkilot/filial, ruxsatlar qisqacha. Til — yuqori panelda.
export const Profile = () => {
  const { t } = useTranslation();
  const { me, role, roleColor, isOwner, readOnly, connected } = useWorker();
  const perms = me?.permissions || [];
  const centers = isOwner ? me?.centers || [] : me?.center ? [me.center] : [];

  return (
    <WorkerPage title={t("worker.profile.title")}>
      <Card className="flex items-center gap-3">
        <div
          className="w-14 h-14 rounded-full grid place-items-center text-white font-extrabold text-lg shrink-0"
          style={{ background: roleColor }}
          aria-hidden="true"
        >
          {initials(me?.name)}
        </div>
        <div className="min-w-0">
          <div className="font-title font-bold text-[17px] break-words">{me?.name || "—"}</div>
          <RoleBadge color={roleColor}>{t(`worker.role.${role}`)}</RoleBadge>
        </div>
      </Card>
      {readOnly && <ReadOnlyNote />}

      <Card>
        <KV label={t("worker.profile.organization")} value={me?.client?.name || "—"} />
        <KV
          label={t("worker.profile.access")}
          value={perms.includes("all") ? t("worker.profile.fullAccess") : t("worker.profile.permsCount", { count: perms.length })}
        />
        <KV
          label={t("worker.profile.realtime")}
          value={t(connected ? "worker.live" : "worker.offline")}
          valueClassName={connected ? "text-ok" : "text-hint"}
        />
      </Card>

      {centers.length > 0 && (
        <>
          <SectionLabel>{t(isOwner ? "worker.profile.centers" : "worker.profile.center")}</SectionLabel>
          <Card className="py-1 divide-y divide-line/70">
            {centers.map((c) => (
              <div key={c._id} className="flex items-center gap-2.5 py-2.5">
                <HiOutlineBuildingOffice2 className="w-5 h-5 text-hint shrink-0" />
                <span className="font-bold truncate">{c.name}</span>
              </div>
            ))}
          </Card>
        </>
      )}

      <div className="text-[13px] text-hint px-1">{t("worker.profile.hint")}</div>
      <Button variant="soft" onClick={closeApp}>
        <HiOutlineArrowRightOnRectangle className="w-5 h-5" />
        {t("worker.profile.close")}
      </Button>
    </WorkerPage>
  );
};
