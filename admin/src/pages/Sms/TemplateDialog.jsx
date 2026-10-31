import { useState } from "react";
import { useTranslation } from "react-i18next";
import Dialog from "../../ui/Dialog";
import Button from "../../ui/Button";
import Input from "../../ui/Input";
import Select from "../../ui/Select";
import Switch from "../../ui/Switch";
import Textarea from "../../ui/Textarea";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import { TOPICS, VARIABLES } from "./smsMeta";

function TemplateDialog({ open, template, onClose, onSaved }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(template?.title || "");
  const [topic, setTopic] = useState(template?.topic || "info");
  const [text, setText] = useState(template?.text || "");
  const [active, setActive] = useState(template?.active ?? true);
  const [saving, setSaving] = useState(false);

  const insert = (variable) => setText((cur) => `${cur}{${variable}}`);

  const save = async () => {
    try {
      setSaving(true);
      const payload = { title, topic, text, active };
      const res = template
        ? await api.put(`/admin/sms/templates/${template._id}`, payload)
        : await api.post("/admin/sms/templates", payload);
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      onSaved();
      onClose();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={template ? t("sms.editTemplate") : t("sms.createTemplate")}
      actions={
        <>
          <Button color="black" variant="text" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button loading={saving} onClick={save}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Input label={t("sms.templateTitle")} value={title} onChange={(e) => setTitle(e.target.value)} />
        <Select
          label={t("sms.topic")}
          value={topic}
          onChange={setTopic}
          options={TOPICS.map((x) => ({ value: x, label: t(`sms.topics.${x}`) }))}
        />
        <Textarea label={t("sms.text")} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex flex-wrap gap-1.5">
          {VARIABLES.map((v) => (
            <button
              type="button"
              key={v}
              onClick={() => insert(v)}
              title={t(`sms.variables.${v}`)}
              className="px-2 py-1 rounded-lg text-xs font-mono border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              {`{${v}}`}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400">{t("sms.charCount", { count: text.length })}</p>
        <Switch checked={active} onChange={setActive} label={t("sms.active")} />
      </div>
    </Dialog>
  );
}

export default TemplateDialog;
