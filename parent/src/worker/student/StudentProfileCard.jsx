import { useTranslation } from "react-i18next";
import { HiOutlinePhone, HiOutlineBanknotes } from "react-icons/hi2";
import { Avatar, Card } from "../../components/Card";
import { initials } from "../../utils/format";
import { callPhone } from "../utils";
import { MetaLine } from "../components/MetaLine";
import { TelegramPill } from "./TelegramPill";
import { ActionChip } from "./ActionChip";

// O'quvchi profili (details §3.1): ism, telefon, ota-ona telefoni, Telegram
// juft belgisi; amallar — Qo'ng'iroq (o'quvchi / ota-ona), To'lov.
export const StudentProfileCard = ({ student: s, canCall, onPay, payDisabled }) => {
  const { t } = useTranslation();
  const hasActions = (canCall && (s.phone || s.parentPhone)) || onPay;
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar text={initials(s.fullName)} className="w-14 h-14 rounded-2xl text-lg" />
        <div className="min-w-0">
          <div className="font-extrabold text-[18px] leading-tight tracking-tight break-words">{s.fullName}</div>
          {canCall && s.phone && <div className="tabular text-[13px] text-hint mt-0.5">{s.phone}</div>}
        </div>
      </div>
      <div className="flex flex-col gap-2 pt-3 border-t border-line/70">
        {canCall && (
          <MetaLine icon={HiOutlinePhone}>
            <span className="text-hint">{t("worker.student.parentPhone")}: </span>
            <span className="tabular font-bold">{s.parentPhone || "—"}</span>
          </MetaLine>
        )}
        <div className="flex flex-wrap gap-1.5">
          <TelegramPill who="student" status={s.studentTelegram} />
          <TelegramPill who="parent" status={s.parentTelegram} />
        </div>
      </div>
      {hasActions && (
        <div className="flex flex-wrap gap-2">
          {canCall && s.phone && (
            <ActionChip icon={HiOutlinePhone} onClick={() => callPhone(s.phone)}>
              {t("worker.student.callStudentShort")}
            </ActionChip>
          )}
          {canCall && s.parentPhone && (
            <ActionChip icon={HiOutlinePhone} onClick={() => callPhone(s.parentPhone)}>
              {t("worker.student.callParentShort")}
            </ActionChip>
          )}
          {onPay && (
            <ActionChip icon={HiOutlineBanknotes} primary disabled={payDisabled} onClick={onPay}>
              {t("worker.student.pay")}
            </ActionChip>
          )}
        </div>
      )}
    </Card>
  );
};
