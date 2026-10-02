import { useTranslation } from "react-i18next";
import { HiOutlineChatBubbleLeftRight } from "react-icons/hi2";
import { Button } from "../components/Button";
import { openTelegramLink } from "../lib/telegram";
import { useAuth } from "../contexts/auth";

const BOT = import.meta.env.VITE_BOT_USERNAME || "wenetuzbot";

export const NotLinked = () => {
  const { t } = useTranslation();
  const { login } = useAuth();
  return (
    <div className="min-h-[calc(100dvh-48px)] flex flex-col items-center justify-center text-center px-6 gap-3">
      <div className="w-20 h-20 rounded-3xl bg-accent/10 grid place-items-center text-accent">
        <HiOutlineChatBubbleLeftRight className="w-10 h-10" />
      </div>
      <h1 className="text-xl font-extrabold mt-2">{t("notLinked.title")}</h1>
      <p className="text-sm text-hint max-w-[34ch]">{t("notLinked.text")}</p>
      <div className="w-full max-w-xs mt-3 space-y-2">
        <Button onClick={() => openTelegramLink(`https://t.me/${BOT}?start=webapp`)}>{t("notLinked.openBot")}</Button>
        <Button variant="ghost" onClick={() => login()}>{t("common.retry")}</Button>
      </div>
      <div className="text-xs text-hint mt-2">@{BOT}</div>
    </div>
  );
};
