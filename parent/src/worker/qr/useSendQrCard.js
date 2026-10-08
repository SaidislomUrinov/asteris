import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { haptic } from "../../lib/telegram";
import { workerApi } from "../api";
import { errText } from "../utils";

// Natija (`{ student, parent }` = "sent" | "failed" | "none") → toast kaliti.
const resultKey = ({ student, parent } = {}) => {
  if (student === "sent" && parent === "sent") return ["success", "worker.qr.sendBoth"];
  if (student === "sent") return parent === "failed" ? ["warning", "worker.qr.sendParentFailed"] : ["success", "worker.qr.sendStudentOnly"];
  if (parent === "sent") return student === "failed" ? ["warning", "worker.qr.sendStudentFailed"] : ["success", "worker.qr.sendParentOnly"];
  return ["error", "attendance.qrSendFailed"];
};

// QR kartani Telegramga yuborish (API_CONTRACT_qr_card_send_and_worker_chat.md
// §A.3): GET /attendance/qr/:id → kartani canvas'da chizish → PNG → POST.
// Bitta loading toast natija bilan almashtiriladi. `busyId` — hozir
// yuborilayotgan o'quvchi (takroriy bosishdan himoya).
export const useSendQrCard = () => {
  const { t } = useTranslation();
  const [busyId, setBusyId] = useState(null);
  const busyRef = useRef(null);

  const send = useCallback(
    async (student) => {
      const id = student?._id;
      if (!id || busyRef.current) return;
      busyRef.current = id;
      setBusyId(id);
      haptic("medium");
      const toastId = `qr-send-${id}`;
      toast.loading(t("worker.qr.sendBusy"), { id: toastId });
      try {
        // Karta chizgich (+ `qrcode`) faqat kerak bo'lganda yuklanadi.
        const [d, { qrCardBlob }] = await Promise.all([workerApi.qrCard(id), import("../../lib/qrCard")]);
        const blob = await qrCardBlob(
          {
            fullName: d.fullName,
            qrToken: d.qrToken,
            centerName: d.center?.name,
            centerLogo: d.center?.logo,
            groups: d.groups,
          },
          t,
        );
        const res = await workerApi.sendQrCard(id, blob);
        const [kind, key] = resultKey(res);
        haptic(kind === "error" ? "error" : kind === "warning" ? "warning" : "success");
        toast[kind](t(key), { id: toastId });
      } catch (e) {
        haptic("error");
        toast.error(errText(e), { id: toastId });
      } finally {
        busyRef.current = null;
        setBusyId(null);
      }
    },
    [t],
  );

  return { send, busyId };
};
