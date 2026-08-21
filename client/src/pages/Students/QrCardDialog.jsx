import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiArrowPath, HiPrinter } from "react-icons/hi2";
import QRCode from "qrcode";
import Button from "../../ui/Button";
import Dialog from "../../ui/Dialog";
import Loading from "../../ui/Loading";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";

// O'quvchining doimiy QR kartasi — chop etib berish yoki telefonda ko'rsatish
// uchun. Token backendda lazy generatsiya qilinadi (`GET /attendance/qr/:id`),
// bu yerda faqat rasmga aylantiriladi. Reset — karta yo'qolganda eski
// tokenni bekor qiladi.
function QrCardDialog({ open, onClose, student }) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [dataUrl, setDataUrl] = useState("");

  const load = useCallback(
    async (reset = false) => {
      if (!student?._id) return;
      reset ? setResetting(true) : setLoading(true);
      try {
        const res = await api.get(`/attendance/qr/${student._id}${reset ? "?reset=true" : ""}`);
        const { ok, data, msg } = res.data;
        if (!ok) throw new Error(msg);
        const url = await QRCode.toDataURL(data.qrToken, { width: 512, margin: 1 });
        setDataUrl(url);
        if (reset) successMsg("attendance.qrReset");
      } catch (error) {
        errorMsg(error.message);
        onClose();
      } finally {
        reset ? setResetting(false) : setLoading(false);
      }
    },
    [student?._id, onClose, t],
  );

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // Chop etish — kartani alohida oynada, faqat QR va ism bilan.
  const print = () => {
    const win = window.open("", "_blank", "width=420,height=560");
    if (!win) return;
    win.document.write(
      `<title>${student.fullName}</title>` +
        `<body style="margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif">` +
        `<img src="${dataUrl}" style="width:280px;height:280px"/>` +
        `<div style="margin-top:16px;font-size:20px;font-weight:600">${student.fullName}</div>` +
        `<div style="margin-top:4px;font-size:14px;color:#64748b">${student.phone || ""}</div>` +
        `</body>`,
    );
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("attendance.qrCardTitle")}
      className="md:w-100"
      actions={
        <>
          <Button variant="text" color="slate" onClick={() => load(true)} loading={resetting}>
            <HiArrowPath className="text-base" />
            {t("attendance.qrResetAction")}
          </Button>
          <Button color="blue" onClick={print} disabled={!dataUrl}>
            <HiPrinter className="text-base" />
            {t("attendance.qrPrint")}
          </Button>
        </>
      }
    >
      {loading ? (
        <Loading />
      ) : (
        <div className="flex flex-col items-center gap-3 py-2">
          {dataUrl && <img src={dataUrl} alt="QR" className="w-56 h-56" />}
          <div className="text-center">
            <p className="text-lg font-semibold text-slate-800">{student?.fullName}</p>
            <p className="text-sm text-slate-500">{student?.phone}</p>
          </div>
          <p className="text-xs text-center text-slate-500 max-w-xs">{t("attendance.qrCardHint")}</p>
        </div>
      )}
    </Dialog>
  );
}

export default QrCardDialog;
