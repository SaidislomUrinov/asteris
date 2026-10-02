import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiQrCode } from "react-icons/hi2";
import Button from "../../ui/Button";
import IconButton from "../../ui/IconButton";
import useCan from "../../hooks/useCan";
import useFeature from "../../hooks/useFeature";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import { downloadGroupQrCardsPdf } from "../Students/qrCard.util";

// Guruhdagi barcha faol o'quvchilarning QR kartalari — bitta A4 PDF
// (varaqqa 10 ta, kesish chiziqlari bilan). Tokeni yo'q o'quvchilarga
// backend shu so'rovda yaratib beradi.
function GroupQrCardsButton({ groupId, variant = "button" }) {
  const { t } = useTranslation();
  const can = useCan();
  const hasFeature = useFeature();
  const [loading, setLoading] = useState(false);

  if (!hasFeature("attendance.qr") || !can("attendance:view")) return null;

  const download = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/attendance/qr/group/${groupId}`);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      if (!data.students.length) throw new Error("attendance.qrGroupEmpty");

      const cards = data.students.map((s) => ({
        fullName: s.fullName,
        qrToken: s.qrToken,
        centerName: data.center.name,
        centerLogo: data.center.logo,
        groups: [data.group.name],
      }));
      await downloadGroupQrCardsPdf(cards, data.group.name, t);
      successMsg("attendance.qrGroupDownloaded");
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (variant === "icon") {
    return (
      <IconButton color="blue" variant="ghost" title={t("attendance.qrGroupCards")} loading={loading} onClick={download}>
        <HiQrCode />
      </IconButton>
    );
  }

  return (
    <Button color="blue" variant="outlined" loading={loading} onClick={download} className="gap-1.5">
      <HiQrCode className="text-base" />
      {t("attendance.qrGroupCards")}
    </Button>
  );
}

export default GroupQrCardsButton;
