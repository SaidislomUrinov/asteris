import { useTranslation } from "react-i18next";
import { HiOutlinePhone, HiOutlineBanknotes, HiOutlineUser } from "react-icons/hi2";
import { BottomSheet } from "../components/BottomSheet";
import { MenuItem } from "../components/MenuItem";
import { callPhone } from "../utils";

// O'quvchi qatori menyusi (details §2): Qo'ng'iroq (o'quvchi / ota-ona),
// To'lov, Profil. Har band faqat ruxsat bo'lsa uzatiladi (`onPay` va h.k.).
export const StudentActionsSheet = ({ student: s, canCall, onPay, onOpen, onClose }) => {
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
        {onOpen && <MenuItem icon={HiOutlineUser} label={t("worker.student.open")} onClick={onOpen} />}
      </div>
    </BottomSheet>
  );
};
