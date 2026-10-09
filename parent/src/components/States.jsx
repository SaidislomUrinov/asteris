import { useTranslation } from "react-i18next";
import { HiOutlineInboxStack, HiOutlineExclamationTriangle } from "react-icons/hi2";
import { Button } from "./Button";

export const EmptyState = ({ icon, title, text, action }) => {
  const Icon = icon || HiOutlineInboxStack;
  return (
  <div className="flex flex-col items-center text-center gap-2 py-10 px-4">
    <div className="w-14 h-14 rounded-2xl bg-ink/6 grid place-items-center text-hint">
      <Icon className="w-7 h-7" />
    </div>
    <div className="font-title font-bold text-ink mt-1 break-words">{title}</div>
    {text && <div className="text-sm text-hint max-w-[28ch]">{text}</div>}
    {action}
  </div>
  );
};

export const ErrorState = ({ error, onRetry }) => {
  const { t } = useTranslation();
  const code = error?.code || "error.unknown";
  const msg = t(code, { defaultValue: t("error.unknown") });
  return (
    <div className="flex flex-col items-center text-center gap-2 py-10 px-4">
      <div className="w-14 h-14 rounded-2xl bg-bad-bg grid place-items-center text-bad">
        <HiOutlineExclamationTriangle className="w-7 h-7" />
      </div>
      <div className="font-title font-bold text-ink mt-1">{t("error.title")}</div>
      <div className="text-sm text-hint max-w-[30ch] break-words">{msg}</div>
      {onRetry && (
        <Button variant="soft" className="w-auto mt-2 py-2.5" onClick={() => onRetry()}>
          {t("common.retry")}
        </Button>
      )}
    </div>
  );
};
