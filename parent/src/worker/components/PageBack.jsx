import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { HiChevronLeft } from "react-icons/hi2";
import { isInTelegram } from "../utils";

// Ichki sahifadagi "orqaga" — faqat Telegram tashqarisida (Telegram'da
// o'zining BackButton'i ishlaydi, WorkerShell boshqaradi).
export const PageBack = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  if (isInTelegram()) return null;
  const back = () => {
    if ((window.history.state?.idx || 0) > 0) navigate(-1);
    else navigate("/", { replace: true });
  };
  return (
    <button
      type="button"
      onClick={back}
      aria-label={t("worker.back")}
      className="w-9 h-9 -ml-2 rounded-full grid place-items-center text-ink active:bg-ink/6 shrink-0"
    >
      <HiChevronLeft className="w-6 h-6" />
    </button>
  );
};
