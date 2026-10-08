import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { HiCalendarDays, HiKey, HiUser } from "react-icons/hi2";
import Avatar from "../../ui/Avatar";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import Chip from "../../ui/Chip";
import { updateUser } from "../../contexts/user";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";

// Client Owner uchun StaffProfile.jsx bilan bir xil "Rekvizitlar" dizayni
// (sarlavha kartasi + ism/parol paneli) — faqat Owner'da maosh/tranzaksiya
// tabi yo'q, shuning uchun tablarsiz, bitta panel.
function OwnerProfile() {
  const { t } = useTranslation();
  const dp = useDispatch();
  const user = useSelector((e) => e.user);

  const [name, setName] = useState(user.name || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const saveRequisites = async () => {
    const wantsPasswordChange = !!currentPassword || !!newPassword;
    if (!name.trim() && !wantsPasswordChange) return;
    if (wantsPasswordChange && (!currentPassword || !newPassword)) {
      return errorMsg("client.fillTheRows");
    }
    try {
      setSaving(true);
      const body = {};
      if (name.trim() && name.trim() !== user.name) body.name = name.trim();
      if (wantsPasswordChange) {
        body.currentPassword = currentPassword;
        body.newPassword = newPassword;
      }
      if (Object.keys(body).length === 0) return;

      const res = await api.patch("/client-auth/profile", body);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      dp(updateUser({ ...data }));
      setCurrentPassword("");
      setNewPassword("");
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col w-full h-full gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-slate-200/70 dark:border-night-700/70 bg-white dark:bg-night-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none">
        <div className="flex items-center gap-4 min-w-0">
          <Avatar user={user} size={56} />
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-space font-bold text-xl text-slate-900 dark:text-slate-100 truncate">{user.name}</p>
              <Chip value={t("auth.roleOwner")} color="blue" variant="ghost" />
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500 flex-wrap">
              {user.phone && (
                <span className="flex items-center gap-1">
                  <HiKey className="text-slate-300 dark:text-slate-600" />
                  {user.phone}
                </span>
              )}
              {user.date && (
                <span className="flex items-center gap-1">
                  <HiCalendarDays className="text-slate-300 dark:text-slate-600" />
                  {user.date}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1 p-5 sm:p-6 rounded-2xl border border-slate-200/70 dark:border-night-700/70 bg-white dark:bg-night-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1px_1fr] gap-6">
          <div className="flex flex-col gap-3">
            <p className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <HiUser className="text-slate-400 dark:text-slate-500" />
              {t("profile.requisitesTitle")}
            </p>
            <Input
              label={t("staff.name")}
              variant="white"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="hidden lg:block w-px bg-slate-100 dark:bg-night-800 self-stretch" />

          <div className="flex flex-col gap-3">
            <p className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <HiKey className="text-slate-400 dark:text-slate-500" />
              {t("profile.changePasswordTitle")}
            </p>
            <Input
              label={t("profile.currentPassword")}
              type="password"
              variant="white"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <Input
              label={t("profile.newPassword")}
              type="password"
              variant="white"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end pt-5 mt-4 border-t border-slate-100 dark:border-night-700">
          <Button color="blue" loading={saving} onClick={saveRequisites} className="w-full sm:w-auto">
            {t("common.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default OwnerProfile;
