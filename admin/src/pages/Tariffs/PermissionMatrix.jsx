import { useTranslation } from "react-i18next";
import Checkbox from "../../ui/Checkbox";
import { featureI18nKey, PERMISSION_CATALOG } from "./permissionCatalog";

export default function PermissionMatrix({ value = [], onChange, disabled = false }) {
  const { t } = useTranslation();
  const has = (perm) => value.includes(perm);

  const toggle = (perm) => {
    onChange(has(perm) ? value.filter((p) => p !== perm) : [...value, perm]);
  };

  const toggleModule = (mod, allSelected) => {
    const keys = mod.items.map((i) => i.key);
    if (allSelected) {
      onChange(value.filter((p) => !keys.includes(p)));
    } else {
      onChange([...new Set([...value, ...keys])]);
    }
  };

  return (
    <div className={`flex flex-col gap-3 w-full ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      {PERMISSION_CATALOG.map((mod) => {
        const keys = mod.items.map((i) => i.key);
        const allSelected = keys.every((k) => has(k));

        return (
          <div
            key={mod.module}
            className="flex flex-col gap-2.5 w-full rounded-xl border border-slate-200 p-3"
          >
            <Checkbox
              checked={allSelected}
              onChange={() => toggleModule(mod, allSelected)}
              variant="square"
              label={t(`tariff.modules.${mod.module}`)}
              className="[&>span]:font-semibold [&>span]:text-slate-800"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {mod.items.map((item) => {
                const checked = has(item.key);
                return (
                  <label
                    key={item.key}
                    className={`flex items-start gap-2.5 rounded-lg border p-2.5 cursor-pointer transition-colors ${
                      checked
                        ? "border-slate-300 bg-slate-50"
                        : "border-slate-100 hover:border-slate-200 hover:bg-slate-50/60"
                    }`}
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      onClick={() => toggle(item.key)}
                      className={`mt-0.5 relative flex items-center justify-center shrink-0 w-5 h-5 rounded-md border-2 transition-all duration-200 ${
                        checked
                          ? "bg-slate-700 border-slate-700"
                          : "bg-white border-slate-400"
                      }`}
                    >
                      {checked && <div className="bg-white w-2 h-2 rounded-sm" />}
                    </button>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-sm font-medium text-slate-800 select-none">
                        {t(`${featureI18nKey(item.key)}.label`)}
                      </span>
                      <span className="text-[12px] text-slate-400 leading-snug select-none">
                        {t(`${featureI18nKey(item.key)}.description`)}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
