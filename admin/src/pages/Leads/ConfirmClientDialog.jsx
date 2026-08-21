import { useState } from "react";
import { useTranslation } from "react-i18next";
import Dialog from "../../ui/Dialog";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";

export default function ConfirmClientDialog({ lead, onClose, onCreated }) {
  const { t } = useTranslation();
  const [step, setStep] = useState("ask"); // ask | password
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const close = () => {
    setStep("ask");
    setPassword("");
    onClose();
  };

  const submit = async () => {
    try {
      if (!password) throw new Error("auth.fillTheRows");
      setLoading(true);
      const res = await api.post(`/leads/${lead._id}/client`, { password });
      const { ok, data, msg, lockedBy } = res.data;
      if (!ok) {
        const err = new Error(msg);
        err.lockedBy = lockedBy;
        throw err;
      }
      successMsg(msg);
      onCreated(data);
      close();
    } catch (error) {
      errorMsg(error.message, error.lockedBy ? { name: error.lockedBy } : undefined);
    } finally {
      setLoading(false);
    }
  };

  if (!lead) return null;

  return (
    <Dialog
      open={!!lead}
      onClose={close}
      title={t("lead.confirmClientTitle")}
      actions={
        step === "ask" ? (
          <>
            <Button color="slate" variant="text" onClick={close}>
              {t("common.no")}
            </Button>
            <Button onClick={() => setStep("password")}>{t("common.yes")}</Button>
          </>
        ) : (
          <>
            <Button color="slate" variant="text" onClick={close}>
              {t("common.cancel")}
            </Button>
            <Button loading={loading} onClick={submit}>
              {t("lead.createClient")}
            </Button>
          </>
        )
      }
    >
      {step === "ask" ? (
        <p className="text-slate-700">{t("lead.confirmClientQuestion")}</p>
      ) : (
        <Input
          label={t("lead.clientPassword")}
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      )}
    </Dialog>
  );
}
