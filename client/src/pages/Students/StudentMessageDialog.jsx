import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiPaperAirplane } from "react-icons/hi2";
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
  }, [open]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const close = () => {
    if (sending) return;
    setTemplateId("");
    setText("");
    onClose();
  };

  const template = templates.find((x) => x._id === templateId);

  const submit = async () => {
    const body = templateId ? { templateId } : { text: text.trim() };
    if (!templateId && !body.text) {
      errorMsg(t("student.message.emptyText"));
      return;
    }
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
      setTemplateId("");
      setText("");
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
            disabled={cooldown > 0 || (!templateId && !text.trim())}
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
        <Select
          variant="slate"
          placeholder={t("sms.template")}
          value={templateId}
          onChange={setTemplateId}
          options={templates.map((x) => ({ value: x._id, label: x.title }))}
        />
        {template ? (
          <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-slate-50 dark:bg-night-800">
            <Chip value={t(`sms.topics.${template.topic}`)} color={TOPIC_COLOR[template.topic]} className="self-start" />
            <p className="text-sm text-slate-600 dark:text-slate-300">{template.text}</p>
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
