import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiArrowDownTray, HiArrowPath, HiDocumentText, HiPhoto } from "react-icons/hi2";
import Button from "../../ui/Button";
import Dialog from "../../ui/Dialog";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import { downloadQrCardPdf, downloadQrCardPng, renderQrCard } from "./qrCard.util";

// O'quvchining doimiy QR kartasi. Token backendda lazy generatsiya qilinadi
// (`GET /attendance/qr/:id`), karta esa `qrCard.util.js` da canvas'da
// chiziladi — dialogdagi ko'rinish yuklab olinadigan fayl bilan AYNAN bir xil.
// Yangilash — karta yo'qolganda eski tokenni bekor qiladi (tasdiq bilan).
function QrCardDialog({ open, onClose, student }) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [downloading, setDownloading] = useState("");
  const [card, setCard] = useState(null);
  const [preview, setPreview] = useState("");

  const studentId = student?._id;

  const load = async (reset = false) => {
    if (!studentId) return;
    reset ? setResetting(true) : setLoading(true);
    try {
      const res = await api.get(`/attendance/qr/${studentId}${reset ? "?reset=true" : ""}`);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      const next = {
        fullName: data.fullName,
        qrToken: data.qrToken,
        centerName: data.center?.name,
        centerLogo: data.center?.logo,
        groups: data.groups,
      };
      const canvas = await renderQrCard(next, t);
      setCard(next);
      setPreview(canvas.toDataURL("image/png"));
      if (reset) successMsg("attendance.qrReset");
    } catch (error) {
      errorMsg(error.message);
      if (!reset) onClose();
    } finally {
      reset ? setResetting(false) : setLoading(false);
      setConfirmReset(false);
    }
  };

  // Har ochilishda token qayta so'raladi (boshqa qurilmada yangilangan
  // bo'lishi mumkin). setTimeout — effekt ichida sinxron setState bo'lmasin.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  useEffect(() => {
    if (!open || !studentId) return undefined;
    const timer = setTimeout(() => loadRef.current(), 0);
    return () => clearTimeout(timer);
  }, [open, studentId]);

  const download = async (kind) => {
    if (!card) return;
    setDownloading(kind);
    try {
      if (kind === "pdf") await downloadQrCardPdf(card, t);
      else await downloadQrCardPng(card, t);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setDownloading("");
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("attendance.qrCardTitle")}
      className="md:w-[34rem]"
      actions={
        <div className="flex flex-wrap items-center justify-end gap-2 w-full">
          <Button
            variant="outlined"
            color="slate"
            onClick={() => download("png")}
            loading={downloading === "png"}
            disabled={!card}
          >
            <HiPhoto className="text-base" />
            PNG
          </Button>
          <Button color="blue" onClick={() => download("pdf")} loading={downloading === "pdf"} disabled={!card}>
            <HiArrowDownTray className="text-base" />
            {t("attendance.qrDownloadPdf")}
          </Button>
        </div>
      }
    >
      {loading || !preview ? (
        <div className="aspect-[85.6/54] w-full rounded-2xl bg-slate-100 animate-pulse" />
      ) : (
        <div className="flex flex-col gap-3">
          <img
            src={preview}
            alt={student?.fullName}
            className="w-full rounded-2xl ring-1 ring-slate-200 shadow-[0_8px_24px_-6px_rgba(15,23,42,0.12)]"
          />

          <p className="flex items-start gap-2 text-xs text-slate-500">
            <HiDocumentText className="text-sm shrink-0 mt-0.5 text-slate-400" />
            {t("attendance.qrCardHint")}
          </p>

          {/* Qayta generatsiya — xavfli amal, shuning uchun ikki bosqichli */}
          <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-slate-50 ring-1 ring-slate-200/70">
            <div className="flex flex-col min-w-48 flex-1">
              <span className="text-sm font-semibold text-slate-800">
                {confirmReset ? t("attendance.qrResetConfirmTitle") : t("attendance.qrResetTitle")}
              </span>
              <span className="text-xs text-slate-500">
                {confirmReset ? t("attendance.qrResetConfirmHint") : t("attendance.qrResetHint")}
              </span>
            </div>
            {confirmReset ? (
              <div className="flex items-center gap-1.5">
                <Button variant="text" color="slate" onClick={() => setConfirmReset(false)}>
                  {t("common.cancel")}
                </Button>
                <Button color="red" onClick={() => load(true)} loading={resetting}>
                  {t("attendance.qrResetAction")}
                </Button>
              </div>
            ) : (
              <Button variant="outlined" color="slate" onClick={() => setConfirmReset(true)}>
                <HiArrowPath className="text-base" />
                {t("attendance.qrResetAction")}
              </Button>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}

export default QrCardDialog;
