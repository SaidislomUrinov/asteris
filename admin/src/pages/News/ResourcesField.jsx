import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { HiPlus, HiTrash } from "react-icons/hi2";
import Button from "../../ui/Button";
import Input from "../../ui/Input";
import Select from "../../ui/Select";
import FieldLabel from "./FieldLabel";
import SegmentControl from "./SegmentControl";
import { CLIENT_PAGE_SECTIONS, clientGroupLabelKey } from "../../utils/clientSections";
import { MAX_RESOURCES, RESOURCE_LABEL_MAX, localKey } from "./newsMeta";

export default function ResourcesField({ resources, setResources, errors = {} }) {
  const { t } = useTranslation();

  const routeOptions = useMemo(
    // Client menyusi tuzilishi bo'yicha: "Moliya › Tushumlar — /revenue".
    () =>
      CLIENT_PAGE_SECTIONS.map((r) => ({
        value: r.path,
        label: `${t(clientGroupLabelKey(r.group))} › ${t(r.labelKey)} — ${r.path}`,
      })),
    [t],
  );

  const kindOptions = [
    { value: "internal", label: t("news.resource.kind.internal") },
    { value: "external", label: t("news.resource.kind.external") },
  ];

  const patch = (key, next) =>
    setResources((prev) => prev.map((r) => (r._key === key ? { ...r, ...next } : r)));

  const add = () =>
    setResources((prev) =>
      prev.length >= MAX_RESOURCES
        ? prev
        : [...prev, { _key: localKey(), label: "", kind: "internal", url: "" }],
    );

  const remove = (key) => setResources((prev) => prev.filter((r) => r._key !== key));

  return (
    <div className="flex flex-col gap-2 w-full">
      <FieldLabel
        hint={t("news.fields.resourcesHint")}
        counter={`${resources.length} / ${MAX_RESOURCES}`}
      >
        {t("news.fields.resources")}
      </FieldLabel>

      {resources.map((r, index) => {
        const err = errors[r._key] || {};
        return (
          <div
            key={r._key}
            className="flex flex-col gap-2 p-3 rounded-xl border border-slate-200 bg-white"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-semibold text-slate-400 tabular-nums">
                #{index + 1}
              </span>
              <SegmentControl
                size="sm"
                value={r.kind}
                options={kindOptions}
                onChange={(kind) => patch(r._key, { kind, url: "" })}
              />
              <button
                type="button"
                onClick={() => remove(r._key)}
                title={t("news.resource.remove")}
                className="ml-auto flex items-center justify-center w-8 h-8 rounded-lg text-red-500 hover:bg-red-50 cursor-pointer shrink-0"
              >
                <HiTrash />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <Input
                  placeholder={t("news.resource.labelPlaceholder")}
                  value={r.label}
                  maxLength={RESOURCE_LABEL_MAX}
                  onChange={(e) => patch(r._key, { label: e.target.value })}
                />
                {err.label && <span className="px-2 text-[12px] text-red-500">{t(err.label)}</span>}
              </div>
              <div className="flex flex-col gap-1">
                {r.kind === "internal" ? (
                  <Select
                    value={r.url}
                    options={
                      r.url && !routeOptions.some((o) => o.value === r.url)
                        ? [{ value: r.url, label: r.url }, ...routeOptions]
                        : routeOptions
                    }
                    placeholder={t("news.resource.pagePlaceholder")}
                    onChange={(url) => patch(r._key, { url })}
                  />
                ) : (
                  <Input
                    placeholder={t("news.resource.urlPlaceholder")}
                    value={r.url}
                    onChange={(e) => patch(r._key, { url: e.target.value })}
                  />
                )}
                {err.url && <span className="px-2 text-[12px] text-red-500">{t(err.url)}</span>}
              </div>
            </div>
          </div>
        );
      })}

      <div>
        <Button
          type="button"
          color="slate"
          variant="ghost"
          disabled={resources.length >= MAX_RESOURCES}
          onClick={add}
        >
          <HiPlus className="text-base" />
          {t("news.resource.add")}
        </Button>
      </div>
    </div>
  );
}
