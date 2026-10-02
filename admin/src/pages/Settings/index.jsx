import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiUserCircle,
  HiEnvelope,
  HiPaperAirplane,
  HiFolderOpen,
  HiCircleStack,
  HiArrowPath,
  HiExclamationTriangle,
} from "react-icons/hi2";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import Button from "../../ui/Button";
import ProfileTab from "./ProfileTab";
import SmtpTab from "./SmtpTab";
import TelegramTab from "./TelegramTab";
import StorageTab from "./StorageTab";
import BackupTab from "./BackupTab";

const TABS = [
  { key: "profile", icon: HiUserCircle },
  { key: "smtp", icon: HiEnvelope },
  { key: "telegram", icon: HiPaperAirplane },
  { key: "storage", icon: HiFolderOpen },
  { key: "backup", icon: HiCircleStack },
];

export default function Settings() {
  const { t } = useTranslation();
  const [tab, setTab] = useState("profile");
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/admin/settings");
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setSettings(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // setTimeout — effect tanasida to'g'ridan-to'g'ri setState chaqirilmasligi uchun
    const timeout = setTimeout(() => fetchSettings(), 0);
    return () => clearTimeout(timeout);
  }, [fetchSettings]);

  // Qisman PATCH — faqat o'zgargan bo'lim yuboriladi.
  // Bo'sh parol/token maydonlari tab ichida tozalab yuboriladi (eskisi saqlanadi).
  const save = async (patch) => {
    try {
      setSaving(true);
      const res = await api.patch("/admin/settings", patch);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setSettings(data);
      successMsg(msg || "systemSettings.saved");
      return true;
    } catch (err) {
      errorMsg(err.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const tabProps = { settings, onSave: save, saving };

  return (
    <div className="flex flex-col w-full gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 w-full shrink-0">
        <p className="text-[18px] font-semibold text-slate-800">
          {t("systemSettings.title")}
        </p>
        <Button color="slate" variant="ghost" onClick={fetchSettings}>
          <HiArrowPath className="text-base" />
          {t("common.refresh")}
        </Button>
      </div>

      {/* Tab'lar */}
      <div className="flex items-center gap-1 w-full overflow-x-auto bg-white p-1.5 rounded-xl border border-zinc-200 shrink-0">
        {TABS.map((item) => {
          const TabIcon = item.icon;
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`inline-flex items-center gap-1.5 px-4 h-9 rounded-lg text-[13px] font-semibold whitespace-nowrap duration-200 cursor-pointer ${
                active
                  ? "bg-slate-800 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <TabIcon className="text-base" />
              {t(`systemSettings.tabs.${item.key}`)}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="flex items-center justify-between gap-2 w-full bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-sm">
          <span className="flex items-center gap-2">
            <HiExclamationTriangle className="text-base shrink-0" />
            {t(error, t("systemSettings.loadError"))}
          </span>
          <Button color="red" variant="text" onClick={fetchSettings}>
            {t("common.retry")}
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-3 w-full bg-white border border-slate-200 rounded-xl p-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 w-full rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : !settings ? (
        <div className="flex items-center justify-center w-full h-40 bg-white border border-slate-200 rounded-xl text-slate-400 text-sm">
          {t("systemSettings.empty")}
        </div>
      ) : (
        <>
          {tab === "profile" && <ProfileTab />}
          {tab === "smtp" && <SmtpTab {...tabProps} />}
          {tab === "telegram" && <TelegramTab {...tabProps} />}
          {tab === "storage" && <StorageTab {...tabProps} />}
          {tab === "backup" && <BackupTab {...tabProps} />}
        </>
      )}
    </div>
  );
}
