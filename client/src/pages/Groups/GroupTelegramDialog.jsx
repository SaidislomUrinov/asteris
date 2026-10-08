import { useState } from "react";
import { useTranslation } from "react-i18next";
// FaTelegram — hi/hi2 qoidasidan foydalanuvchi aniq so'ragan istisno (ui/TelegramBotLink.jsx).
import { FaTelegram } from "react-icons/fa";
import Dialog from "../../ui/Dialog";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";

/**
 * Guruhning Telegram guruh manzilini ulash/o'zgartirish/uzish
 * (`PATCH /groups/:id/telegram`). Manzil bot orqali ota-ona va o'quvchilarga
 * "Guruh" inline tugmasi sifatida va WebApp'da ko'rsatiladi.
 * Normallashtirish (`@nom`, `t.me/...` → `https://t.me/...`) serverda.
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {Object|null} props.group - kamida `{ _id, telegramLink }`
 * @param {string} [props.label] - dialog sarlavhasidagi guruh nomi
 * @param {() => void} props.onClose
 * @param {(group: Object) => void} [props.onSaved] - server qaytargan DTO
 */
function GroupTelegramDialog({ open, group, label, onClose, onSaved }) {
  const { t } = useTranslation();
  const [link, setLink] = useState(group?.telegramLink || "");
  const [saving, setSaving] = useState(null);

  const save = async (value) => {
    try {
      setSaving(value ? "save" : "remove");
      const res = await api.patch(`/groups/${group._id}/telegram`, { telegramLink: value || null });
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(value ? "group.telegramSaved" : "group.telegramRemoved");
      onSaved?.(data);
      onClose();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setSaving(null);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("group.telegramDialogTitle")}
      actions={
        <>
          {group?.telegramLink && (
            <Button
              color="red"
              variant="text"
              className="mr-auto"
              loading={saving === "remove"}
              disabled={!!saving}
              onClick={() => save(null)}
            >
              {t("group.telegramRemove")}
            </Button>
          )}
          <Button color="black" variant="text" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            color="blue"
            loading={saving === "save"}
            disabled={!!saving || !link.trim()}
            onClick={() => save(link.trim())}
          >
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 w-full">
        {label && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#229ED9]/[0.06] ring-1 ring-inset ring-[#229ED9]/15">
            <FaTelegram className="text-2xl text-[#229ED9] shrink-0" aria-hidden="true" />
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{label}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{t("group.telegramDialogDesc")}</span>
            </div>
          </div>
        )}
        <Input
          label={t("group.telegramLink")}
          placeholder="https://t.me/+AbCdEf..."
          icon={<FaTelegram />}
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && link.trim() && !saving) save(link.trim());
          }}
          hint={t("group.telegramLinkHint")}
          autoFocus
        />
      </div>
    </Dialog>
  );
}

export default GroupTelegramDialog;
