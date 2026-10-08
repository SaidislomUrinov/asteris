import { useTranslation } from "react-i18next";
import {
  HiOutlinePhone,
  HiOutlineBanknotes,
  HiOutlineUser,
  HiOutlinePaperAirplane,
  HiOutlineCamera,
  HiOutlineTrash,
} from "react-icons/hi2";
import { haptic } from "../../lib/telegram";
import { BottomSheet } from "../components/BottomSheet";
import { MenuItem } from "../components/MenuItem";
import { callPhone } from "../utils";

// O'quvchi qatori menyusi (details §2): Qo'ng'iroq (o'quvchi / ota-ona),
// To'lov, QR kartani Telegramga yuborish, Rasm (barcha rollar), Profil. Har band faqat ruxsat bo'lsa
// uzatiladi (`onPay` va h.k.). `qrDisabled` — hech kim Telegram'ga ulanmagan:
// band xira, izoh bilan, bosilmaydi (API_CONTRACT_qr_card_send_and_worker_chat.md §A.3).
export const StudentActionsSheet = ({ student: s, canCall, onPay, onSendQr, qrDisabled, onPhoto, onRemovePhoto, onOpen, onClose }) => {
  const { t } = useTranslation();
  return (
    <BottomSheet open onClose={onClose} title={s.fullName} subtitle={canCall ? s.phone : null}>
      <div className="flex flex-col divide-y divide-line/70">
        {canCall && s.phone && (
          <MenuItem icon={HiOutlinePhone} label={t("worker.student.callStudent")} hint={s.phone} onClick={() => callPhone(s.phone)} />
        )}
        {canCall && s.parentPhone && (
          <MenuItem
            icon={HiOutlinePhone}
            label={t("worker.student.callParent")}
            hint={s.parentPhone}
            onClick={() => callPhone(s.parentPhone)}
          />
        )}
        {onPay && <MenuItem icon={HiOutlineBanknotes} label={t("worker.student.pay")} onClick={onPay} />}
        {onSendQr && (
          <MenuItem
            icon={HiOutlinePaperAirplane}
            label={t("worker.qr.sendAction")}
            hint={qrDisabled ? t("worker.qr.sendNoTelegram") : null}
            disabled={qrDisabled}
            onClick={() => (qrDisabled ? haptic("warning") : onSendQr())}
          />
        )}
        {onPhoto && (
          <MenuItem
            icon={HiOutlineCamera}
            label={t(s.photo ? "worker.student.photoReplace" : "worker.student.photoAdd")}
            onClick={onPhoto}
          />
        )}
        {onRemovePhoto && <MenuItem icon={HiOutlineTrash} label={t("worker.student.photoRemove")} onClick={onRemovePhoto} />}
        {onOpen && <MenuItem icon={HiOutlineUser} label={t("worker.student.open")} onClick={onOpen} />}
      </div>
    </BottomSheet>
  );
};
