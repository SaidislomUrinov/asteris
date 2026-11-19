import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiBuildingOffice2, HiPaperAirplane, HiUser } from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Button from "../../ui/Button";
import Select from "../../ui/Select";
import Chip from "../../ui/Chip";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import { TOPIC_COLOR } from "../Sms/smsFormat";

const MAX_LENGTH = 1000;

// O'quvchi profilidan Telegram/SMS xabar yuborish — docs/API_CONTRACT_profile_test_and_student_notify.md §2.
// Ikki kanal uchun bitta dialog (`channel` prop): shablon tanlash yoki erkin
// matn. Telegram'da yuborilgandan keyin 20s cooldown (tugma disable + sanoq),
// SMS'da cooldown yo'q (balans yetmasa mavjud `sms.insufficientBalance` xatosi
// avtomatik tarjima qilinadi — utils/alert.js `errorMsg`).
function StudentMessageDialog({ open, onClose, studentId, channel }) {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0); // qolgan soniya (faqat telegram)
  const [recipients, setRecipients] = useState([]); // faqat telegram: [{role, staffId?, name?, linked}]
  const [recipient, setRecipient] = useState(null); // {role, staffId?}
  // Tanlangan shablonning shu o'quvchi uchun to'ldirilgan ko'rinishi:
  // { text, studentName, centerName } — server yuboriladigan matn bilan bir xil render qiladi.
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewSeq = useRef(0);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!open || loadedRef.current) return;
    loadedRef.current = true;
    (async () => {
      try {
        const res = await api.get("/sms/templates");
        if (res.data.ok) setTemplates(res.data.data || []);
      } catch {
        // shablonlar ikkinchi darajali — erkin matn bilan ham yuborish mumkin
      }
    })();
    if (channel === "telegram") {
      (async () => {
        try {
          const res = await api.get(`/students/${studentId}/message/recipients`);
          if (res.data.ok) {
            const options = res.data.data || [];
            setRecipients(options);
            const firstLinked = options.find((o) => o.linked);
            if (firstLinked) setRecipient({ role: firstLinked.role, staffId: firstLinked.staffId || null });
          }
        } catch {
          // ro'yxat yuklanmasa ham eski xatti-harakat (parent+student) ishlaydi
        }
      })();
    }
  }, [open, channel, studentId]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const pickTemplate = async (id) => {
    setTemplateId(id);
    setPreview(null);
    if (!id) return;
    const seq = ++previewSeq.current;
    setPreviewLoading(true);
    try {
      const res = await api.post(`/students/${studentId}/message/preview`, { templateId: id });
      if (seq === previewSeq.current && res.data.ok) setPreview(res.data.data);
    } catch (error) {
      if (seq === previewSeq.current) errorMsg(error.message);
    } finally {
      if (seq === previewSeq.current) setPreviewLoading(false);
    }
  };

  const resetPreview = () => {
    previewSeq.current += 1;
    setPreview(null);
    setPreviewLoading(false);
  };

  const close = () => {
    if (sending) return;
    resetPreview();
    setTemplateId("");
    setText("");
    loadedRef.current = false;
    setRecipients([]);
    setRecipient(null);
    onClose();
  };

  const template = templates.find((x) => x._id === templateId);

  const submit = async () => {
    const body = templateId ? { templateId } : { text: text.trim() };
    if (!templateId && !body.text) {
      errorMsg(t("student.message.emptyText"));
      return;
    }
    if (channel === "telegram" && recipient) body.recipient = recipient.role;
    setSending(true);
    try {
      const res = await api.post(`/students/${studentId}/message/${channel}`, body);
      const { ok, msg, data } = res.data;
      if (!ok) {
        if (msg === "student.message.cooldown") {
          const retryAfterSec = data?.retryAfterSec || 20;
          setCooldown(retryAfterSec);
          errorMsg(t("student.message.cooldownToast", { sec: retryAfterSec }));
          return;
        }
        throw new Error(msg);
      }
      successMsg(msg);
      if (channel === "telegram") setCooldown(20);
      resetPreview();
      setTemplateId("");
      setText("");
      loadedRef.current = false;
      setRecipients([]);
      setRecipient(null);
      onClose();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t(channel === "telegram" ? "student.message.telegramTitle" : "student.message.smsTitle")}
      widthClass="md:w-125"
      actions={
        <>
          <Button color="black" variant="text" onClick={close} disabled={sending}>
            {t("common.cancel")}
          </Button>
          <Button
            loading={sending}
            disabled={
              cooldown > 0 ||
              (!templateId && !text.trim()) ||
              (!!templateId && !preview) ||
              (channel === "telegram" && recipients.length > 0 && !recipient)
            }
            onClick={submit}
            className="gap-1.5"
          >
            <HiPaperAirplane className="text-base" />
            {t("student.message.send")}
            {cooldown > 0 && <span className="tabular-nums">{t("student.message.cooldownShort", { sec: cooldown })}</span>}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {channel === "telegram" && recipients.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {recipients.map((opt, i) => {
              const key = `${opt.role}:${opt.staffId || i}`;
              const selected = recipient && recipient.role === opt.role && (recipient.staffId || null) === (opt.staffId || null);
              const label = opt.name || t(`student.message.recipient.${opt.role}`);
              return (
                <button
                  key={key}
                  type="button"
                  disabled={!opt.linked}
                  onClick={() => setRecipient({ role: opt.role, staffId: opt.staffId || null })}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium duration-200 ${
                    selected
                      ? "bg-blue-500 text-white"
                      : opt.linked
                        ? "bg-slate-100 dark:bg-night-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-night-700"
                        : "bg-slate-50 dark:bg-night-900 text-slate-300 dark:text-slate-600 cursor-not-allowed"
                  }`}
                >
                  {label}
                  {!opt.linked && <span className="ml-1 text-[11px]">({t("student.message.recipient.notLinked")})</span>}
                </button>
              );
            })}
          </div>
        )}
        <Select
          variant="slate"
          placeholder={t("sms.template")}
          value={templateId}
          onChange={pickTemplate}
          options={templates.map((x) => ({ value: x._id, label: x.title }))}
        />
        {template ? (
          <div className="flex flex-col gap-2.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-night-800">
            <Chip value={t(`sms.topics.${template.topic}`)} color={TOPIC_COLOR[template.topic]} className="self-start" />
            {previewLoading || !preview ? (
              <div className="flex flex-col gap-2 animate-pulse" aria-busy="true">
                <div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-night-700" />
                <div className="h-3.5 w-full rounded bg-slate-200 dark:bg-night-700" />
                <div className="h-3.5 w-4/5 rounded bg-slate-200 dark:bg-night-700" />
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <span className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 min-w-0">
                    <HiUser className="shrink-0 text-base text-slate-400 dark:text-slate-500" />
                    <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">{t("student.message.previewStudent")}</span>
                    <span className="font-semibold truncate">{preview.studentName || "—"}</span>
                  </span>
                  <span className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 min-w-0">
                    <HiBuildingOffice2 className="shrink-0 text-base text-slate-400 dark:text-slate-500" />
                    <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">{t("student.message.previewCenter")}</span>
                    <span className="font-semibold truncate">{preview.centerName || "—"}</span>
                  </span>
                </div>
                <div className="flex flex-col gap-1 pt-2.5 border-t border-slate-200/70 dark:border-night-700">
                  <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">{t("student.message.previewText")}</span>
                  <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-wrap wrap-break-word">{preview.text}</p>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <textarea
              rows={5}
              value={text}
              maxLength={MAX_LENGTH}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("student.message.placeholder")}
              className="w-full resize-y rounded-xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 px-3 py-2 text-sm leading-relaxed text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:ring-3 ring-blue-500/15 duration-200"
            />
            <span className="self-end text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
              {text.length}/{MAX_LENGTH}
            </span>
          </div>
        )}
      </div>
    </Dialog>
  );
}

export default StudentMessageDialog;
