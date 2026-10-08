import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { HiOutlineDevicePhoneMobile, HiOutlineLockClosed, HiOutlineQrCode } from "react-icons/hi2";
import { Button } from "../../components/Button";
import { Card, SectionLabel } from "../../components/Card";
import { EmptyState } from "../../components/States";
import { qrScanSupport } from "../../lib/telegram";
import { useWorker } from "../useWorker";
import { qrAllowed } from "../constants";
import { WorkerPage } from "../components/WorkerPage";
import { ReadOnlyNote } from "../components/ReadOnlyNote";
import { KpiCard } from "../components/KpiCard";
import { useQrScanner } from "../qr/useQrScanner";
import { QrGroupSheet } from "../qr/QrGroupSheet";
import { QrResultRow } from "../qr/QrResultRow";
import { QrNotice } from "../qr/QrNotice";

// "QR davomat" — `/qr` (API_CONTRACT_worker_qr_attendance.md §3). Telegram
// skaneri ketma-ket o'qiydi, natijalar shu sessiya uchun xotirada.
// Kirish nuqtalari `state.autoStart` bilan ochsa — skaner darhol ochiladi.
export const QrAttendance = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const worker = useWorker();
  const { roleColor, readOnly } = worker;
  const allowed = qrAllowed(worker);
  const support = qrScanSupport();
  const ready = allowed && support === "ok";
  const { scanning, busy, results, stats, choice, start, stop, chooseGroup, cancelChoice } = useQrScanner({ enabled: ready });

  // Bir martalik avto-ochish: state darhol tozalanadi (orqaga/oldinga
  // qaytganda qayta ochilmasin).
  const autoStart = !!location.state?.autoStart;
  const autoRef = useRef(false);
  useEffect(() => {
    if (!autoStart || autoRef.current) return;
    autoRef.current = true;
    navigate(location.pathname, { replace: true, state: null });
    if (ready) setTimeout(start, 0);
  }, [autoStart, ready, start, navigate, location.pathname]);

  if (!allowed) {
    return (
      <WorkerPage title={t("worker.qr.title")}>
        {readOnly ? (
          <ReadOnlyNote />
        ) : (
          <QrNotice mark={<HiOutlineLockClosed />} title={t("worker.qr.noAccess")} text={t("worker.qr.noAccessText")} />
        )}
      </WorkerPage>
    );
  }

  return (
    <WorkerPage title={t("worker.qr.title")}>
      {support !== "ok" && (
        <QrNotice mark={<HiOutlineDevicePhoneMobile />} title={t(`worker.qr.${support}.title`)} text={t(`worker.qr.${support}.text`)} />
      )}

      <Card className="flex flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <span
            className="w-11 h-11 shrink-0 rounded-xl grid place-items-center"
            style={{ color: roleColor, backgroundColor: `color-mix(in srgb, ${roleColor} 12%, transparent)` }}
          >
            <HiOutlineQrCode className="w-6 h-6" />
          </span>
          <p className="text-[13.5px] text-hint leading-snug min-w-0">{t("worker.qr.hint")}</p>
        </div>
        {scanning ? (
          <Button variant="soft" onClick={stop} className="min-h-13">
            {t("worker.qr.stop")}
          </Button>
        ) : (
          <Button
            onClick={start}
            disabled={!ready || !!choice}
            className="text-white min-h-13 text-base"
            style={{ background: roleColor, boxShadow: ready ? `0 8px 18px -10px ${roleColor}` : "none" }}
          >
            <HiOutlineQrCode className="w-5 h-5" />
            {t("worker.qr.start")}
          </Button>
        )}
        {busy && (
          <div className="flex items-center justify-center gap-2 text-[12.5px] text-hint">
            <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
            {t("worker.qr.sending")}
          </div>
        )}
      </Card>

      <SectionLabel right={<span className="text-[12px] font-bold text-hint tabular">{t("worker.qr.total", { count: stats.total })}</span>}>
        {t("worker.qr.session")}
      </SectionLabel>
      <div className="grid grid-cols-2 min-[400px]:grid-cols-4 gap-2">
        <KpiCard label={t("worker.qr.status.present")} value={stats.present} tone={stats.present > 0 ? "ok" : undefined} />
        <KpiCard label={t("worker.qr.status.late")} value={stats.late} tone={stats.late > 0 ? "warn" : undefined} />
        <KpiCard label={t("worker.qr.status.duplicate")} value={stats.duplicate} />
        <KpiCard label={t("worker.qr.status.error")} value={stats.error} tone={stats.error > 0 ? "bad" : undefined} />
      </div>

      <SectionLabel>{t("worker.qr.recent")}</SectionLabel>
      {results.length === 0 ? (
        <EmptyState icon={HiOutlineQrCode} title={t("worker.qr.empty")} text={t("worker.qr.emptyText")} />
      ) : (
        <Card className="py-1 px-3.5 divide-y divide-line/70">
          {results.map((r) => (
            <QrResultRow key={r.id} item={r} />
          ))}
        </Card>
      )}

      <QrGroupSheet choice={choice} onChoose={chooseGroup} onClose={cancelChoice} />
    </WorkerPage>
  );
};
