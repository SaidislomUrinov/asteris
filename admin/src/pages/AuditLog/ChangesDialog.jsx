import { useTranslation } from "react-i18next";
import Chip from "../../ui/Chip";
import Dialog from "../../ui/Dialog";
import Button from "../../ui/Button";
import { actionColor } from "./actionMeta";

// Mixed qiymatni o'qishga qulay matnga aylantiradi (obyekt/massiv/bool/null)
const renderValue = (value, emptyText) => {
  if (value === null || value === undefined || value === "") return emptyText;
  if (typeof value === "boolean") return value ? "✓" : "✕";
  if (Array.isArray(value)) return value.length ? value.join(", ") : emptyText;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

export default function ChangesDialog({ log, onClose }) {
  const { t } = useTranslation();
  const changes = log?.changes || [];

  return (
    <Dialog
      open={!!log}
      onClose={onClose}
      title={t("audit.detailTitle")}
      className="md:w-175"
      actions={
        <Button color="slate" variant="text" onClick={onClose}>
          {t("common.close")}
        </Button>
      }
    >
      {log && (
        <div className="flex flex-col w-full gap-4">
          {/* Umumiy ma'lumot */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Info label={t("audit.action")}>
              <Chip value={t(`audit.actions.${log.action}`, log.action)} color={actionColor(log.action)} />
            </Info>
            <Info label={t("audit.date")}>
              <span className="text-slate-700 text-sm">{log.date}</span>
            </Info>
            <Info label={t("audit.actor")}>
              <span className="text-slate-700 text-sm">
                {log.actor?.name || "—"}
                {log.actor?.role ? (
                  <span className="text-slate-400"> · {t(`audit.roles.${log.actor.role}`, log.actor.role)}</span>
                ) : null}
              </span>
            </Info>
            <Info label={t("audit.actorKind")}>
              <span className="text-slate-700 text-sm">
                {t(`audit.kinds.${log.actor?.kind}`, log.actor?.kind || "—")}
              </span>
            </Info>
            <Info label={t("audit.entity")}>
              <span className="text-slate-700 text-sm">
                {t(`audit.entities.${log.entity?.type}`, log.entity?.type || "—")}
                {log.entity?.label ? (
                  <span className="text-slate-400"> · {log.entity.label}</span>
                ) : null}
              </span>
            </Info>
            <Info label={t("audit.client")}>
              <span className="text-slate-700 text-sm">
                {log.client?.name || t("audit.platformLevel")}
              </span>
            </Info>
            {log.center?.name && (
              <Info label={t("audit.center")}>
                <span className="text-slate-700 text-sm">{log.center.name}</span>
              </Info>
            )}
          </div>

          {/* Changes jadvali */}
          <div className="flex flex-col w-full gap-1">
            <span className="pl-1 text-sm font-semibold text-slate-800">
              {t("audit.changes")}
            </span>

            {changes.length === 0 ? (
              <div className="flex items-center justify-center w-full h-20 text-slate-400 text-sm border border-slate-200 rounded-xl">
                {t("audit.noChanges")}
              </div>
            ) : (
              <div className="w-full overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-sm min-w-max">
                  <thead>
                    <tr className="bg-slate-50 text-left text-slate-500 text-[12px] uppercase">
                      <th className="px-3 py-2.5 font-semibold">{t("audit.field")}</th>
                      <th className="px-3 py-2.5 font-semibold">{t("audit.from")}</th>
                      <th className="px-3 py-2.5 font-semibold">{t("audit.to")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changes.map((c, i) => (
                      <tr key={`${c.field}-${i}`} className="border-t border-slate-100">
                        <td className="px-3 py-2.5 font-medium text-slate-800">
                          {t(`audit.fields.${c.field}`, c.field)}
                        </td>
                        <td className="px-3 py-2.5 text-slate-500 line-through decoration-slate-300">
                          {renderValue(c.from, t("audit.emptyValue"))}
                        </td>
                        <td className="px-3 py-2.5 text-emerald-700 font-medium">
                          {renderValue(c.to, t("audit.emptyValue"))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}

function Info({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="pl-1 text-[12px] uppercase text-slate-400 font-semibold">
        {label}
      </span>
      <div className="flex items-center">{children}</div>
    </div>
  );
}
