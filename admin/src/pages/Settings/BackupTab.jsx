import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { HiCheckCircle, HiPlay, HiArrowPath } from "react-icons/hi2";
import { api } from "../../utils/fetching";
import i18n from "../../utils/i18n";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import Switch from "../../ui/Switch";
import Chip from "../../ui/Chip";
import List from "../../ui/List";
import Section from "./Section";

const buildForm = (settings) => {
  const b = settings?.backup || {};
  return {
    enabled: !!b.enabled,
    cron: b.cron || "0 3 * * *",
    keepDays: b.keepDays ?? 7,
  };
};

export default function BackupTab({ settings, onSave, saving }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => buildForm(settings));
  const [files, setFiles] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [running, setRunning] = useState(false);

  // Prop o'zgarganda qayta to'ldirish — render fazasida (effect emas)
  const [prevSettings, setPrevSettings] = useState(settings);
  if (settings !== prevSettings) {
    setPrevSettings(settings);
    setForm(buildForm(settings));
  }

  const fetchList = useCallback(async () => {
    try {
      setListLoading(true);
      const res = await api.get("/admin/settings/backup/list");
      if (!res.data?.ok) throw new Error(res.data?.msg);
      setFiles(res.data.data || []);
    } catch {
      setFiles([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    // setTimeout — effect tanasida to'g'ridan-to'g'ri setState chaqirilmasligi uchun
    const timeout = setTimeout(() => fetchList(), 0);
    return () => clearTimeout(timeout);
  }, [fetchList]);

  const set = (key) => (value) => setForm((p) => ({ ...p, [key]: value }));

  const submit = () =>
    onSave({
      backup: {
        enabled: form.enabled,
        cron: form.cron,
        keepDays: Number(form.keepDays) || 0,
      },
    });

  const runNow = async () => {
    setRunning(true);
    const request = (async () => {
      const res = await api.post("/admin/settings/backup/run");
      if (!res.data?.ok) throw new Error(res.data?.msg || "systemSettings.backup.failed");
      return res.data;
    })();

    toast.promise(request, {
      loading: i18n.t("systemSettings.backup.running"),
      success: (d) =>
        i18n.t("systemSettings.backup.success", {
          file: d?.data?.file || "",
          size: d?.data?.sizeMb ?? 0,
        }),
      error: (e) => i18n.t(e.message || "systemSettings.backup.failed"),
    });

    try {
      await request;
      fetchList();
    } catch {
      // xato toast.promise orqali ko'rsatildi
    } finally {
      setRunning(false);
    }
  };

  const lastStatus = settings?.backup?.lastStatus;

  const columns = [
    {
      key: "file",
      header: t("systemSettings.backup.file"),
      className: "font-medium text-slate-800",
      render: (row) => row.file,
    },
    {
      key: "size",
      header: t("systemSettings.backup.size"),
      className: "text-slate-600",
      render: (row) => `${Math.round((row.sizeMb || 0) * 100) / 100} MB`,
    },
    {
      key: "createdAt",
      header: t("systemSettings.backup.createdAt"),
      className: "text-slate-500",
      render: (row) => row.date || row.createdAt,
    },
  ];

  return (
    <div className="flex flex-col w-full gap-3">
      <Section
        title={t("systemSettings.backup.title")}
        description={t("systemSettings.backup.description")}
        actions={
          <>
            <Button color="blue" variant="ghost" loading={running} onClick={runNow}>
              <HiPlay className="text-base" />
              {t("systemSettings.backup.runNow")}
            </Button>
            <Button loading={saving} onClick={submit}>
              <HiCheckCircle className="text-base" />
              {t("common.save")}
            </Button>
          </>
        }
      >
        <Switch
          color="emerald"
          checked={form.enabled}
          onChange={set("enabled")}
          label={t("systemSettings.backup.enabled")}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
          <div className="flex flex-col gap-1">
            <Input
              label={t("systemSettings.backup.cron")}
              placeholder="0 3 * * *"
              value={form.cron}
              onChange={(e) => set("cron")(e.target.value)}
            />
            <span className="pl-2 text-[11px] text-slate-400">
              {t("systemSettings.backup.cronHint")}
            </span>
          </div>
          <Input
            label={t("systemSettings.backup.keepDays")}
            type="number"
            min="1"
            value={form.keepDays}
            onChange={(e) => set("keepDays")(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[12px] text-slate-400">
            {t("systemSettings.backup.lastRun")}:
          </span>
          <span className="text-[13px] font-medium text-slate-700">
            {settings?.backup?.lastRunText || settings?.backup?.lastRunAt || "—"}
          </span>
          {lastStatus && (
            <Chip
              value={t(`systemSettings.backup.statuses.${lastStatus}`, lastStatus)}
              color={lastStatus === "success" ? "emerald" : "red"}
            />
          )}
        </div>
      </Section>

      <div className="flex flex-col w-full gap-2">
        <div className="flex items-center justify-between gap-2 w-full">
          <p className="text-[15px] font-semibold text-slate-800">
            {t("systemSettings.backup.listTitle")}{" "}
            <span className="text-slate-400 text-sm font-normal">({files.length})</span>
          </p>
          <Button color="slate" variant="ghost" onClick={fetchList}>
            <HiArrowPath className="text-base" />
            {t("common.refresh")}
          </Button>
        </div>

        <div className="w-full h-80">
          <List
            columns={columns}
            rows={files}
            rowKey={(row) => row.file}
            loading={listLoading}
            empty={t("systemSettings.backup.empty")}
          />
        </div>
      </div>
    </div>
  );
}
