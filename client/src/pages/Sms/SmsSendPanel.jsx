import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiCheckCircle, HiExclamationCircle, HiEye, HiPaperAirplane } from "react-icons/hi2";
import Button from "../../ui/Button";
import Dialog from "../../ui/Dialog";
import Input from "../../ui/Input";
import Select from "../../ui/Select";
import Switch from "../../ui/Switch";
import Chip from "../../ui/Chip";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import { TOPIC_COLOR, fmtNum } from "./smsFormat";

const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });

function SmsSendPanel({ templates, groups, onSent, isOwner, onBuy }) {
  const { t } = useTranslation();
  const [templateId, setTemplateId] = useState("");
  const [audience, setAudience] = useState("parents");
  const [groupIds, setGroupIds] = useState([]);
  const [debtOnly, setDebtOnly] = useState(false);
  const [date, setDate] = useState(today());
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const insufficient = !!preview && preview.enough === false;

  const template = useMemo(() => templates.find((x) => x._id === templateId), [templates, templateId]);
  const forcedDebt = !!template && /\{debt\}/.test(template.text);
  const isAbsent = template?.topic === "absent";

  // Sozlama o'zgarsa eski oldindan ko'rish yaroqsiz.
  useEffect(() => {
    const timer = setTimeout(() => setPreview(null), 0);
    return () => clearTimeout(timer);
  }, [templateId, audience, groupIds, debtOnly, date]);

  const body = () => ({
    templateId,
    audience,
    groupIds,
    debtOnly: debtOnly || forcedDebt,
    date: isAbsent ? date : undefined,
  });

  const toggleGroup = (id) => setGroupIds((cur) => (cur.includes(id) ? cur.filter((g) => g !== id) : [...cur, id]));

  const runPreview = async () => {
    try {
      setPreviewing(true);
      const res = await api.post("/sms/preview", body());
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setPreview(data);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setPreviewing(false);
    }
  };

  const send = async () => {
    try {
      setSending(true);
      const res = await api.post("/sms/send", body());
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      setConfirmOpen(false);
      setPreview(null);
      onSent?.();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none">
      <h2 className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
        <HiPaperAirplane className="text-blue-500" />
        {t("sms.sendTitle")}</h2>

      <div className="flex flex-wrap items-center gap-2.5 [&>*]:flex-1 [&>*]:min-w-[200px]">
        <Select
          variant="slate"
          placeholder={t("sms.template")}
          value={templateId}
          onChange={setTemplateId}
          options={templates.map((x) => ({ value: x._id, label: x.title }))}
        />
        <Select
          variant="slate"
          value={audience}
          onChange={setAudience}
          options={[
            { value: "parents", label: t("sms.audienceParents") },
            { value: "students", label: t("sms.audienceStudents") },
          ]}
        />
        {isAbsent && <Input type="date" variant="slate" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />}
      </div>

      {template && (
        <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-slate-50 dark:bg-night-800">
          <Chip value={t(`sms.topics.${template.topic}`)} color={TOPIC_COLOR[template.topic]} className="self-start" />
          <p className="text-sm text-slate-600 dark:text-slate-300">{template.text}</p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t("sms.groups")}</span>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setGroupIds([])}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${groupIds.length === 0 ? "bg-blue-500 text-white border-blue-500" : "border-slate-200 dark:border-night-700 text-slate-600 dark:text-slate-300"}`}
          >
            {t("common.all")}
          </button>
          {groups.map((g) => (
            <button
              type="button"
              key={g._id}
              onClick={() => toggleGroup(g._id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${groupIds.includes(g._id) ? "bg-blue-500 text-white border-blue-500" : "border-slate-200 dark:border-night-700 text-slate-600 dark:text-slate-300"}`}
            >
              {g.name}
            </button>
          ))}
        </div>
      </div>

      {!isAbsent && (
        <Switch checked={debtOnly || forcedDebt} disabled={forcedDebt} onChange={setDebtOnly} label={t("sms.debtOnly")} />
      )}

      {preview && (
        <div
          className={`flex flex-col gap-2 p-3 rounded-xl border ${
            insufficient
              ? "border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10"
              : "border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p
              className={`flex items-center gap-2 text-sm font-semibold ${
                insufficient ? "text-red-600 dark:text-red-400" : "text-blue-700 dark:text-blue-300"
              }`}
            >
              {insufficient ? <HiExclamationCircle className="text-lg shrink-0" /> : <HiCheckCircle className="text-lg shrink-0" />}
              <span>
                {t("sms.previewSummary", {
                  count: fmtNum(preview.total),
                  segments: fmtNum(preview.totalSegments ?? preview.total),
                  balance: fmtNum(preview.balance ?? 0),
                })}
                {preview.noPhone > 0 && ` · ${t("sms.previewNoPhone", { count: preview.noPhone })}`}
              </span>
            </p>
            {insufficient && isOwner && (
              <Button variant="outlined" color="red" onClick={onBuy}>
                {t("sms.buyPackage")}
              </Button>
            )}
          </div>
          {insufficient && <span className="text-xs font-semibold text-red-600 dark:text-red-400">{t("sms.insufficient")}</span>}
          {preview.sample.length > 0 && (
            <div className="flex flex-col gap-1 pt-2 border-t border-black/5 dark:border-white/10">
              {preview.sample.map((s) => (
                <p key={s.phone + s.text} className="text-xs text-slate-600 dark:text-slate-300">
                  <b>{s.name}</b> ({s.phone}): {s.text}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 sm:justify-end">
        <div className="flex-1 sm:flex-none">
          <Button variant="outlined" disabled={!templateId} loading={previewing} onClick={runPreview} className="gap-1.5 w-full">
            <HiEye className="text-base" />
            {t("sms.preview")}
          </Button>
        </div>
        <div className="flex-1 sm:flex-none">
          <Button disabled={!preview || preview.total === 0 || insufficient} onClick={() => setConfirmOpen(true)} className="gap-1.5 w-full">
            <HiPaperAirplane className="text-base" />
            {t("sms.send")}
          </Button>
        </div>
      </div>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t("sms.send")}
        actions={
          <>
            <Button color="black" variant="text" onClick={() => setConfirmOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button loading={sending} onClick={send}>
              {t("sms.send")}
            </Button>
          </>
        }
      >
        <p>{t("sms.sendConfirm", { count: preview?.total || 0 })}</p>
      </Dialog>
    </div>
  );
}

export default SmsSendPanel;
