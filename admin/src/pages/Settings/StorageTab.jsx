import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiCheckCircle } from "react-icons/hi2";
import Input from "../../ui/Input";
import Select from "../../ui/Select";
import Button from "../../ui/Button";
import Section from "./Section";

const DRIVERS = ["local", "s3"];

const buildForm = (settings) => {
  const st = settings?.storage || {};
  return {
    driver: st.driver || "local",
    baseUrl: st.baseUrl || "",
    maxFileMb: st.maxFileMb ?? 10,
  };
};

export default function StorageTab({ settings, onSave, saving }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => buildForm(settings));

  // Prop o'zgarganda qayta to'ldirish — render fazasida (effect emas)
  const [prevSettings, setPrevSettings] = useState(settings);
  if (settings !== prevSettings) {
    setPrevSettings(settings);
    setForm(buildForm(settings));
  }

  const set = (key) => (value) => setForm((p) => ({ ...p, [key]: value }));

  const submit = () =>
    onSave({
      storage: {
        driver: form.driver,
        baseUrl: form.baseUrl,
        maxFileMb: Number(form.maxFileMb) || 0,
      },
    });

  return (
    <Section
      title={t("systemSettings.storage.title")}
      description={t("systemSettings.storage.description")}
      actions={
        <Button loading={saving} onClick={submit}>
          <HiCheckCircle className="text-base" />
          {t("common.save")}
        </Button>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
        <Select
          label={t("systemSettings.storage.driver")}
          value={form.driver}
          onChange={set("driver")}
          options={DRIVERS.map((d) => ({
            value: d,
            label: t(`systemSettings.storage.drivers.${d}`),
          }))}
        />
        <Input
          label={t("systemSettings.storage.maxFileMb")}
          type="number"
          min="1"
          value={form.maxFileMb}
          onChange={(e) => set("maxFileMb")(e.target.value)}
        />
        <div className="sm:col-span-2">
          <Input
            label={t("systemSettings.storage.baseUrl")}
            placeholder="https://cdn.asteris.uz"
            value={form.baseUrl}
            onChange={(e) => set("baseUrl")(e.target.value)}
          />
        </div>
      </div>

      <p className="text-[11px] text-slate-400 leading-relaxed">
        {t("systemSettings.storage.hint")}
      </p>
    </Section>
  );
}
