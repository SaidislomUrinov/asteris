import { useTranslation } from "react-i18next";
import Dialog from "../../ui/Dialog";
import Chip from "../../ui/Chip";
import { ACTION_COLOR, verbOf } from "./actionColor";

// `changes` ichidagi qiymat har xil tipda kelishi mumkin (son, mantiqiy,
// massiv, obyekt yoki null) — jadvalda o'qishga qulay ko'rinishga keltiramiz.
// Sana/summa formatlash bu yerda ataylab qilinmaydi: audit "xom haqiqat"ni
// ko'rsatadi, aks holda kim nimani yozganini tekshirib bo'lmay qoladi.
const readable = (v, t) => {
  if (v === null || v === undefined || v === "") return t("audit.emptyValue");
  if (typeof v === "boolean") return v ? t("common.yes") : t("common.no");
  if (Array.isArray(v)) return v.length ? v.join(", ") : t("audit.emptyValue");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

/**
 * Bitta audit yozuvining tafsiloti — `Maydon | Edi | Bo'ldi` jadvali.
 * Yaratish/o'chirish amallarida `changes` bo'sh bo'lishi normal holat.
 */
function ChangesDialog({ open, log, onClose }) {
  const { t } = useTranslation();
  const changes = log?.changes || [];
  const verb = verbOf(log?.action);

  return (
    <Dialog open={open} onClose={onClose} title={t("audit.detailTitle")}>
      {log && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={t("audit.actor")} value={log.actor?.name} sub={log.actor?.role} />
            <Field
              label={t("audit.action")}
              value={
                <Chip
                  value={t(`audit.actions.${log.action}`, { defaultValue: log.action })}
                  color={ACTION_COLOR[verb] || "slate"}
                />
              }
            />
            <Field
              label={t("audit.entity")}
              value={log.entity?.label || "—"}
              sub={log.entity?.type}
            />
            <Field label={t("audit.date")} value={log.date} sub={log.center?.name} />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-slate-800">{t("audit.changes")}</p>

            {changes.length === 0 ? (
              <p className="text-sm text-slate-400">{t("audit.noChanges")}</p>
            ) : (
              <div className="w-full overflow-x-auto rounded-xl border border-slate-200">
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
                        <td className="px-3 py-2.5 font-medium text-slate-700">
                          {t(`audit.fields.${c.field}`, { defaultValue: c.field })}
                        </td>
                        <td className="px-3 py-2.5 text-slate-400 line-through">
                          {readable(c.from, t)}
                        </td>
                        <td className="px-3 py-2.5 text-slate-800">{readable(c.to, t)}</td>
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

function Field({ label, value, sub }) {
  return (
    <div className="flex flex-col gap-0.5 p-3 rounded-xl bg-slate-50">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </span>
      <span className="text-sm text-slate-800 truncate">{value || "—"}</span>
      {sub && <span className="text-xs text-slate-400 truncate">{sub}</span>}
    </div>
  );
}

export default ChangesDialog;
