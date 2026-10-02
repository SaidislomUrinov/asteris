import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { HiCheckCircle } from "react-icons/hi2";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import { updateUser } from "../../contexts/user";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import Section from "./Section";

export default function ProfileTab() {
  const { t } = useTranslation();
  const dp = useDispatch();
  const user = useSelector((e) => e.user);

  const [name, setName] = useState(user?.name || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const wantsPasswordChange = !!(
    currentPassword ||
    newPassword ||
    confirmPassword
  );

  const submit = async () => {
    const trimmedName = name.trim();

    if (!trimmedName && !wantsPasswordChange) {
      errorMsg("systemSettings.profile.nothingToUpdate");
      return;
    }

    const body = {};
    if (trimmedName && trimmedName !== user?.name) body.name = trimmedName;

    if (wantsPasswordChange) {
      if (!currentPassword.trim()) {
        errorMsg("systemSettings.profile.currentPasswordRequired");
        return;
      }
      if (newPassword.trim().length < 6) {
        errorMsg("systemSettings.profile.passwordTooShort");
        return;
      }
      if (newPassword.trim() !== confirmPassword.trim()) {
        errorMsg("systemSettings.profile.passwordMismatch");
        return;
      }
      body.currentPassword = currentPassword.trim();
      body.newPassword = newPassword.trim();
    }

    if (!Object.keys(body).length) return;

    try {
      setSaving(true);
      const res = await api.patch("/admin/profile", body);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      dp(updateUser(data));
      successMsg(msg || "systemSettings.profile.saved");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      errorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col w-full gap-3">
      <Section
        title={t("systemSettings.profile.title")}
        description={t("systemSettings.profile.description")}
        actions={
          <Button loading={saving} onClick={submit}>
            <HiCheckCircle className="text-base" />
            {t("common.save")}
          </Button>
        }
      >
        <Input
          label={t("systemSettings.profile.name")}
          placeholder={t("systemSettings.profile.name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Section>

      <Section
        title={t("systemSettings.profile.passwordTitle")}
        description={t("systemSettings.profile.passwordDescription")}
      >
        <Input
          label={t("systemSettings.profile.currentPassword")}
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
          <Input
            label={t("systemSettings.profile.newPassword")}
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Input
            label={t("systemSettings.profile.confirmPassword")}
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
      </Section>
    </div>
  );
}
