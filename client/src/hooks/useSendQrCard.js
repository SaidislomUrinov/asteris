import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiPaperAirplane } from "react-icons/hi2";
import useCan from "./useCan";
import useFeature from "./useFeature";
import { errorMsg, successMsg } from "../utils/alert";
import { fetchQrCard, renderQrCardBlob, sendQrCardPng } from "../pages/Students/qrCard.util";

// Telegram ulanganmi — o'quvchining o'zi YOKI ota-onasi (kamida bittasi).
export const isQrSendable = (student) =>
  student?.studentTelegram === "linked" || student?.parentTelegram === "linked";

// Server natijasiga qarab toast matni (docs/API_CONTRACT_qr_card_send_and_worker_chat.md A.2):
// data.student / data.parent — "sent" | "failed" | "none".
const notifyResult = ({ student, parent } = {}) => {
  const studentSent = student === "sent";
  const parentSent = parent === "sent";
  if (studentSent && parentSent) successMsg("student.qrSentBoth");
  else if (studentSent) successMsg("student.qrSentStudent");
  else if (parentSent) successMsg("student.qrSentParent");
  else successMsg("attendance.qrCardSent");

  if (student === "failed") errorMsg("student.qrSendFailedStudent");
  if (parent === "failed") errorMsg("student.qrSendFailedParent");
};

/**
 * QR kartani Telegramga yuborish oqimi bitta joyda:
 * GET /attendance/qr/:id → canvas → PNG Blob → POST /attendance/qr/:id/send.
 *
 * - `canSend` — band/tugma ko'rinishi (tarif + ruxsat).
 * - `send(student, card?)` — tayyor karta berilsa (QrCardDialog) qayta so'ralmaydi.
 * - `sendingId` — hozir yuborilayotgan o'quvchi `_id` si (loading uchun).
 * - `menuItems(student)` — DropMenu bandlari massivi (ko'rinmasa bo'sh `[]`),
 *   `items={[...boshqa, ...menuItems(row)]}` shaklida yoyiladi.
 */
export default function useSendQrCard() {
  const { t } = useTranslation();
  const can = useCan();
  const hasFeature = useFeature();
  const [sendingId, setSendingId] = useState("");
  const busyRef = useRef(false);

  const canSend = hasFeature("attendance.qr") && can("attendance:view");

  const send = useCallback(
    async (student, readyCard) => {
      const studentId = student?._id;
      if (!studentId || busyRef.current) return;
      if (!isQrSendable(student)) {
        errorMsg("attendance.qrNoTelegram");
        return;
      }
      busyRef.current = true;
      setSendingId(studentId);
      try {
        const card = readyCard || (await fetchQrCard(studentId));
        const blob = await renderQrCardBlob(card, t);
        const result = await sendQrCardPng(studentId, blob);
        notifyResult(result);
      } catch (error) {
        errorMsg(error.message);
      } finally {
        busyRef.current = false;
        setSendingId("");
      }
    },
    [t],
  );

  const menuItems = (student) => {
    if (!canSend || !student) return [];
    const sendable = isQrSendable(student);
    const sending = sendingId === student._id;
    return [{
      label: sending ? t("student.qrSending") : t("student.qrSendAction"),
      icon: HiPaperAirplane,
      iconClass: "bg-sky-50 text-sky-600",
      disabled: !sendable || Boolean(sendingId),
      hint: sendable ? undefined : t("student.qrSendNoTelegramHint"),
      onClick: () => send(student),
    }];
  };

  return { canSend, send, sendingId, menuItems };
}
