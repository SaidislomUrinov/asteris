import { useTranslation } from "react-i18next";
import { HiPaperAirplane } from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Button from "../../ui/Button";

export default function PublishDialog({ open, title, audience, loading, onClose, onConfirm }) {
  const { t } = useTranslation();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("news.publishTitle")}
      actions={
        <>
          <Button color="slate" variant="text" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button color="emerald" loading={loading} onClick={onConfirm}>
            <HiPaperAirplane className="text-base" />
            {t("news.publish")}
          </Button>
        </>
      }
    >
      <p className="text-slate-700 text-sm">
        {t("news.publishConfirm", {
          title: title || "",
          audience: audience ? t(`news.audience.${audience}`) : "",
        })}
      </p>
    </Dialog>
  );
}
