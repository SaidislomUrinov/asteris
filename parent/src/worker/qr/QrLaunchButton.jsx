import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { HiOutlineQrCode } from "react-icons/hi2";
import { Button } from "../../components/Button";
import { haptic } from "../../lib/telegram";
import { useWorker } from "../useWorker";
import { qrAllowed } from "../constants";

// QR davomatga kirish tugmasi (AttendanceSheet sarlavhasi — `compact`,
// guruh detali Davomat tabi — to'liq). `/qr` ga o'tadi va skaner darhol
// ochiladi. Ruxsat/tarif yo'q yoki faqat ko'rish rejimida — ko'rinmaydi.
export const QrLaunchButton = ({ compact = false, onBeforeOpen }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const worker = useWorker();
  if (!qrAllowed(worker)) return null;

  const open = () => {
    haptic("light");
    onBeforeOpen?.();
    navigate("/qr", { state: { autoStart: true } });
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={open}
        aria-label={t("worker.qr.title")}
        className="h-7 px-2.5 rounded-full bg-accent/10 text-accent inline-flex items-center gap-1 text-[12px] font-extrabold leading-none active:opacity-70"
      >
        <HiOutlineQrCode className="w-4 h-4" />
        QR
      </button>
    );
  }
  return (
    <Button variant="soft" onClick={open} className="min-h-11 py-2.5">
      <HiOutlineQrCode className="w-5 h-5" />
      {t("worker.qr.scanner")}
    </Button>
  );
};
