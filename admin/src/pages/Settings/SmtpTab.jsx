import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { HiCheckCircle, HiPaperAirplane, HiLockClosed } from "react-icons/hi2";
import { api } from "../../utils/fetching";
import i18n from "../../utils/i18n";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import Switch from "../../ui/Switch";
import Chip from "../../ui/Chip";
import Section from "./Section";

const buildForm = (settings) => {
  const smtp = settings?.smtp || {};
  return {
    enabled: !!smtp.enabled,
    host: smtp.host || "",
    port: smtp.port ?? 587,
    secure: !!smtp.secure,
    user: smtp.user || "",
    fromName: smtp.fromName || "",
    fromEmail: smtp.fromEmail || "",
  };
};

export default function SmtpTab({ settings, onSave, saving }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => buildForm(settings));
  const [pass, setPass] = useState("");
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);

  // Prop o'zgarganda formani qayta to'ldirish — render fazasida (effect emas),
  // React tavsiya qilgan "adjusting state on prop change" naqshi (ui/Dialog bilan bir xil).
  const [prevSettings, setPrevSettings] = useState(settings);
  if (settings !== prevSettings) {
    setPrevSettings(settings);
    setForm(buildForm(settings));
    setPass("");
  }

  const set = (key) => (value) => setForm((p) => ({ ...p, [key]: value }));

  const submit = async () => {
    // Parol bo'sh bo'lsa umuman yuborilmaydi — server eskisini saqlaydi
    const smtp = { ...form, port: Number(form.port) || 0 };
    if (pass.trim()) smtp.pass = pass.trim();
    const ok = await onSave({ smtp });
    if (ok) setPass("");
  };

  const sendTest = async () => {
    if (!testTo.trim()) return;
    setTesting(true);
    const request = (async () => {
      const res = await api.post("/admin/settings/test-smtp", { to: testTo.trim() });
      if (!res.data?.ok) throw new Error(res.data?.msg || "systemSettings.testFailed");
      return res.data;
    })();

    toast.promise(request, {
      loading: i18n.t("systemSettings.testSending"),
      success: (d) => i18n.t(d?.msg || "systemSettings.smtpTestSuccess"),
      error: (e) => i18n.t(e.message || "systemSettings.testFailed"),
    });

    try {
      await request;
    } catch {
      // xato toast.promise orqali ko'rsatildi
    } finally {
      setTesting(false);
    }
  };

  const hasPassword = !!settings?.smtp?.hasPassword;

  return (
    <div className="flex flex-col w-full gap-3">
      <Section
        title={t("systemSettings.smtp.title")}
        description={t("systemSettings.smtp.description")}
        actions={
          <Button loading={saving} onClick={submit}>
            <HiCheckCircle className="text-base" />
            {t("common.save")}
          </Button>
        }
      >
        <Switch
          color="emerald"
          checked={form.enabled}
          onChange={set("enabled")}
          label={t("systemSettings.smtp.enabled")}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
          <Input
            label={t("systemSettings.smtp.host")}
            placeholder="smtp.example.com"
            value={form.host}
            onChange={(e) => set("host")(e.target.value)}
          />
          <Input
            label={t("systemSettings.smtp.port")}
            type="number"
            placeholder="587"
            value={form.port}
            onChange={(e) => set("port")(e.target.value)}
          />
          <Input
            label={t("systemSettings.smtp.user")}
            placeholder="no-reply@asteris.uz"
            value={form.user}
            onChange={(e) => set("user")(e.target.value)}
          />

          <div className="flex flex-col gap-1 w-full">
            <Input
              label={t("systemSettings.smtp.pass")}
              type="password"
              placeholder="••••••"
              autoComplete="new-password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
            />
            <span className="flex items-center gap-1 pl-2 text-[11px] text-slate-400">
              <HiLockClosed className="shrink-0" />
              {hasPassword
                ? t("systemSettings.secretSetHint")
                : t("systemSettings.secretEmptyHint")}
            </span>
          </div>

          <Input
            label={t("systemSettings.smtp.fromName")}
            placeholder="Asteris"
            value={form.fromName}
            onChange={(e) => set("fromName")(e.target.value)}
          />
          <Input
            label={t("systemSettings.smtp.fromEmail")}
            placeholder="no-reply@asteris.uz"
            value={form.fromEmail}
            onChange={(e) => set("fromEmail")(e.target.value)}
          />
        </div>

        <Switch
          color="emerald"
          checked={form.secure}
          onChange={set("secure")}
          label={t("systemSettings.smtp.secure")}
        />
      </Section>

      <Section
        title={t("systemSettings.smtp.testTitle")}
        description={t("systemSettings.smtp.testDescription")}
        actions={
          <Button
            color="blue"
            loading={testing}
            disabled={!testTo.trim()}
            onClick={sendTest}
          >
            <HiPaperAirplane className="text-base" />
            {t("systemSettings.test")}
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Chip
            value={
              form.enabled
                ? t("systemSettings.enabledOn")
                : t("systemSettings.enabledOff")
            }
            color={form.enabled ? "emerald" : "slate"}
          />
        </div>
        <Input
          label={t("systemSettings.smtp.testTo")}
          type="email"
          placeholder="admin@example.com"
          value={testTo}
          onChange={(e) => setTestTo(e.target.value)}
        />
      </Section>
    </div>
  );
}
