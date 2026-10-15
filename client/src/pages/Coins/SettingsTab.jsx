import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiStar, HiClipboardDocumentCheck, HiCalendarDays, HiTrophy } from "react-icons/hi2";
import Button from "../../ui/Button";
import Switch from "../../ui/Switch";
import CoinIcon from "../../ui/CoinIcon";
import RuleInput from "./RuleInput";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";

const GRADE_VALUES = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

const EMPTY = {
  enabled: false,
  grades: {},
  homework: { done: 0, partial: 0 },
  attendance: { present: 0 },
  medals: { gold: 0, silver: 0, bronze: 0 },
};

// Server DTO → forma holati (baholar — qiymat → tanga xaritasi).
const toForm = (d) => ({
  enabled: !!d?.enabled,
  grades: Object.fromEntries((d?.rules?.grades || []).map((g) => [g.value, g.coins])),
  homework: { ...EMPTY.homework, ...d?.rules?.homework },
  attendance: { ...EMPTY.attendance, ...d?.rules?.attendance },
  medals: { ...EMPTY.medals, ...d?.rules?.medals },
});

/**
 * WECOIN qoidalari — oy yakunida qaysi natija uchun necha tanga.
 *
 * @param {Object} props
 * @param {string} props.centerId
 * @param {boolean} props.canManage - `coin:manage`
 */
function SettingsTab({ centerId, canManage }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(EMPTY);
  const [saved, setSaved] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(false);
      const res = await api.get(`/coins/${centerId}/settings`);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setForm(toForm(data));
      setSaved(toForm(data));
    } catch (err) {
      errorMsg(err.message);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [centerId]);

  useEffect(() => {
    const id = setTimeout(load, 0);
    return () => clearTimeout(id);
  }, [load]);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved]);

  const patch = (section, key, value) => setForm((f) => ({ ...f, [section]: { ...f[section], [key]: value } }));

  const save = async () => {
    try {
      setSaving(true);
      const body = {
        enabled: form.enabled,
        rules: {
          grades: GRADE_VALUES.map((value) => ({ value, coins: form.grades[value] || 0 })).filter((g) => g.coins > 0),
          homework: form.homework,
          attendance: form.attendance,
          medals: form.medals,
        },
      };
      const res = await api.put(`/coins/${centerId}/settings`, body);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      setForm(toForm(data));
      setSaved(toForm(data));
    } catch (err) {
      errorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-32 rounded-2xl bg-slate-100 dark:bg-night-800 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-sm text-slate-400 dark:text-slate-500">
        {t("common.error")}
        <Button variant="outlined" color="slate" onClick={load}>
          {t("common.retry")}
        </Button>
      </div>
    );
  }

  const disabled = !canManage;
  const section = (Icon, color, title, children) => (
    <section className="flex flex-col gap-3 p-4 max-sm:p-3 rounded-2xl bg-white dark:bg-night-900 border border-slate-200/80 dark:border-night-700/80">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
        <span className={`w-7 h-7 grid place-items-center rounded-lg ${color}`}>
          <Icon className="text-base" />
        </span>
        {title}
      </h3>
      {children}
    </section>
  );

  return (
    <div className="flex flex-col gap-3 max-w-4xl">
      <div
        className={`flex items-center gap-3 p-4 max-sm:p-3 rounded-2xl border transition-colors ${
          form.enabled
            ? "bg-emerald-50/60 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30"
            : "bg-white dark:bg-night-900 border-slate-200/80 dark:border-night-700/80"
        }`}
      >
        <span className="w-10 h-10 shrink-0 grid place-items-center rounded-xl bg-amber-50 dark:bg-amber-500/15">
          <CoinIcon size={22} />
        </span>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t("coins.enable")}</span>
          <span className="text-[12px] text-slate-400 dark:text-slate-500">{t("coins.enableHint")}</span>
        </div>
        <Switch checked={form.enabled} disabled={disabled} color="emerald" onChange={(v) => setForm((f) => ({ ...f, enabled: v }))} />
      </div>

      <div className={`flex flex-col gap-3 ${form.enabled ? "" : "opacity-60"}`}>
        {section(
          HiStar,
          "bg-blue-50 dark:bg-blue-500/15 text-blue-500",
          t("coins.rules.grades"),
          <div className="grid grid-cols-5 max-sm:grid-cols-3 gap-2">
            {GRADE_VALUES.map((v) => (
              <RuleInput
                key={v}
                label={t("coins.rules.grade", { value: v })}
                value={form.grades[v] || 0}
                disabled={disabled}
                onChange={(n) => patch("grades", v, n)}
              />
            ))}
          </div>,
        )}

        <div className="grid grid-cols-2 max-md:grid-cols-1 gap-3">
          {section(
            HiClipboardDocumentCheck,
            "bg-violet-50 dark:bg-violet-500/15 text-violet-500",
            t("coins.rules.homework"),
            <div className="grid grid-cols-2 gap-2">
              <RuleInput label={t("homework.results.done")} value={form.homework.done} disabled={disabled} onChange={(n) => patch("homework", "done", n)} />
              <RuleInput label={t("homework.results.partial")} value={form.homework.partial} disabled={disabled} onChange={(n) => patch("homework", "partial", n)} />
            </div>,
          )}
          {section(
            HiCalendarDays,
            "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-500",
            t("coins.rules.attendance"),
            <div className="grid grid-cols-2 gap-2">
              <RuleInput label={t("coins.rules.present")} value={form.attendance.present} disabled={disabled} onChange={(n) => patch("attendance", "present", n)} />
            </div>,
          )}
        </div>

        {section(
          HiTrophy,
          "bg-amber-50 dark:bg-amber-500/15 text-amber-500",
          t("coins.rules.medals"),
          <div className="grid grid-cols-3 gap-2">
            {["gold", "silver", "bronze"].map((k, i) => (
              <RuleInput
                key={k}
                label={t("coins.rules.place", { position: i + 1 })}
                value={form.medals[k]}
                disabled={disabled}
                onChange={(n) => patch("medals", k, n)}
              />
            ))}
          </div>,
        )}
      </div>

      {canManage && (
        <div className="flex items-center justify-end gap-2 sticky bottom-0 py-2">
          {dirty && (
            <Button variant="ghost" color="slate" onClick={() => setForm(saved)}>
              {t("common.cancel")}
            </Button>
          )}
          <Button loading={saving} disabled={!dirty} onClick={save}>
            {t("common.save")}
          </Button>
        </div>
      )}
    </div>
  );
}

export default SettingsTab;
