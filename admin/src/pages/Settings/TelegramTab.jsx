import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  HiCheckCircle,
  HiPaperAirplane,
  HiLockClosed,
} from "react-icons/hi2";
import { api } from "../../utils/fetching";
import i18n from "../../utils/i18n";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import Switch from "../../ui/Switch";
import Chip from "../../ui/Chip";
import Section from "./Section";
import ChatIdList from "./ChatIdList";

const ALERT_KEYS = [
  "serverError",
  "healthDegraded",
  "subscriptionExpiring",
  "newLead",
  "leadStatus",
];

const buildAlerts = (settings) =>
  ALERT_KEYS.reduce(
    (acc, k) => ({ ...acc, [k]: !!settings?.telegram?.alerts?.[k] }),
    {},
  );

const buildChatIds = (settings, key = "alertChatIds") =>
  Array.isArray(settings?.telegram?.[key]) ? settings.telegram[key] : [];

export default function TelegramTab({ settings, onSave, saving }) {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(() => !!settings?.telegram?.enabled);
  const [botToken, setBotToken] = useState("");
  const [parentWebAppUrl, setParentWebAppUrl] = useState(() => settings?.telegram?.parentWebAppUrl || "");
  const [chatIds, setChatIds] = useState(() => buildChatIds(settings));
  const [leadChatIds, setLeadChatIds] = useState(() => buildChatIds(settings, "leadChatIds"));
  const [alerts, setAlerts] = useState(() => buildAlerts(settings));
  const [testing, setTesting] = useState(false);

  // Prop o'zgarganda qayta to'ldirish — render fazasida (effect emas)
  const [prevSettings, setPrevSettings] = useState(settings);
  if (settings !== prevSettings) {
    setPrevSettings(settings);
    setEnabled(!!settings?.telegram?.enabled);
    setChatIds(buildChatIds(settings));
    setLeadChatIds(buildChatIds(settings, "leadChatIds"));
    setAlerts(buildAlerts(settings));
    setBotToken("");
    setParentWebAppUrl(settings?.telegram?.parentWebAppUrl || "");
  }

  const submit = async () => {
    // Token bo'sh bo'lsa yuborilmaydi — server eskisini saqlaydi
    const telegram = { enabled, alertChatIds: chatIds, leadChatIds, alerts, parentWebAppUrl: parentWebAppUrl.trim() };
    if (botToken.trim()) telegram.botToken = botToken.trim();
    const ok = await onSave({ telegram });
    if (ok) setBotToken("");
  };

  const sendTest = async () => {
    setTesting(true);
    const request = (async () => {
      const res = await api.post("/admin/settings/test-telegram");
      if (!res.data?.ok) throw new Error(res.data?.msg || "systemSettings.testFailed");
      return res.data;
    })();

    toast.promise(request, {
      loading: i18n.t("systemSettings.testSending"),
      success: (d) => i18n.t(d?.msg || "systemSettings.telegramTestSuccess"),
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

  const hasToken = !!settings?.telegram?.hasBotToken;

  return (
    <div className="flex flex-col w-full gap-3">
      <Section
        title={t("systemSettings.telegram.title")}
        description={t("systemSettings.telegram.description")}
        actions={
          <Button loading={saving} onClick={submit}>
            <HiCheckCircle className="text-base" />
            {t("common.save")}
          </Button>
        }
      >
        <Switch
          color="emerald"
          checked={enabled}
          onChange={setEnabled}
          label={t("systemSettings.telegram.enabled")}
        />

        <div className="flex flex-col gap-1 w-full">
          <Input
            label={t("systemSettings.telegram.botToken")}
            type="password"
            placeholder="••••••"
            autoComplete="new-password"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
          />
          <span className="flex items-center gap-1 pl-2 text-[11px] text-slate-400">
            <HiLockClosed className="shrink-0" />
            {hasToken
              ? t("systemSettings.secretSetHint")
              : t("systemSettings.secretEmptyHint")}
          </span>
        </div>

        {/* Ota-ona WebApp manzili — bot xabarlaridagi "Batafsil ko'rish" tugmasi */}
        <div className="flex flex-col gap-1 w-full">
          <Input
            label={t("systemSettings.telegram.parentWebAppUrl")}
            placeholder="https://parent.wenet.uz"
            value={parentWebAppUrl}
            onChange={(e) => setParentWebAppUrl(e.target.value)}
          />
          <span className="pl-2 text-[11px] text-slate-400">{t("systemSettings.telegram.parentWebAppUrlHint")}</span>
        </div>

        {/* Alert chat ID lar */}
        <ChatIdList
          label={t("systemSettings.telegram.chatIds")}
          hint={t("systemSettings.telegram.chatIdsHint")}
          value={chatIds}
          onChange={setChatIds}
        />

        {/* Lead chatlari — yangi lead va status o'zgarishi shu yerga ketadi */}
        <ChatIdList
          label={t("systemSettings.telegram.leadChatIds")}
          hint={t("systemSettings.telegram.leadChatIdsHint")}
          value={leadChatIds}
          onChange={setLeadChatIds}
        />

        {/* Alert turlari */}
        <div className="flex flex-col gap-2 w-full pt-2 border-t border-slate-100">
          <span className="pl-2 text-sm text-slate-800">
            {t("systemSettings.telegram.alerts")}
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ALERT_KEYS.map((key) => (
              <Switch
                key={key}
                color="emerald"
                checked={!!alerts[key]}
                onChange={(v) => setAlerts((p) => ({ ...p, [key]: v }))}
                label={t(`systemSettings.telegram.alertTypes.${key}`)}
              />
            ))}
          </div>
        </div>
      </Section>

      <Section
        title={t("systemSettings.telegram.testTitle")}
        description={t("systemSettings.telegram.testDescription")}
        actions={
          <Button
            color="blue"
            loading={testing}
            disabled={!enabled || chatIds.length === 0}
            onClick={sendTest}
          >
            <HiPaperAirplane className="text-base" />
            {t("systemSettings.test")}
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Chip
            value={enabled ? t("systemSettings.enabledOn") : t("systemSettings.enabledOff")}
            color={enabled ? "emerald" : "slate"}
          />
          <Chip
            value={t("systemSettings.telegram.chatCount", { count: chatIds.length })}
            color="slate"
            variant="ghost"
          />
        </div>
      </Section>
    </div>
  );
}
