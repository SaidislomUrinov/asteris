import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Dialog from "../../ui/Dialog";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import { downloadClientCredentialsPdf } from "./pdf.util";

const initial = { name: "", phone: "", password: "" };

export default function ClientDialog({ open, onClose, client, onSaved }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(false);

  const isEdit = !!client;

  useEffect(() => {
    if (!open) return;
    const timeout = setTimeout(() => {
      setForm(
        client
          ? { name: client.name || "", phone: client.phone || "", password: "" }
          : initial,
      );
    }, 0);
    return () => clearTimeout(timeout);
  }, [open, client]);

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const submit = async () => {
    try {
      setLoading(true);
      const res = isEdit
        ? await api.patch(`/clients/${client._id}`, form)
        : await api.post("/clients", form);
      const { ok, msg, data } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);

      if (!isEdit) {
        downloadClientCredentialsPdf({
          name: data.name,
          phone: data.phone,
          password: data.plainPassword,
          clientId: data.clientId,
        });
      }

      onSaved(data);
      onClose();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? t("client.edit") : t("client.new")}
      actions={
        <>
          <Button color="slate" variant="text" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button loading={loading} onClick={submit}>
            {isEdit ? t("common.save") : t("common.create")}
          </Button>
        </>
      }
    >
      <Input label={t("client.name")} required value={form.name} onChange={set("name")} />
      <Input label={t("client.phone")} required value={form.phone} onChange={set("phone")} />
      <Input
        label={t("client.password")}
        required={!isEdit}
        type="password"
        placeholder={isEdit ? t("client.passwordEditHint") : ""}
        value={form.password}
        onChange={set("password")}
      />
      {!isEdit && (
        <p className="text-[12px] text-slate-400">{t("client.pdfHint")}</p>
      )}
    </Dialog>
  );
}
