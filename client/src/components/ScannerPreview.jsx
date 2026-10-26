import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { HiXMark } from "react-icons/hi2";
import { useScanner } from "../contexts/scanner";

// Kamera yoqiq bo'lganda burchakdagi kichik jonli oyna. "Davomat" sahifasida
// katta ko'rinish bor — u yerda chiqmaydi. X faqat oynani yopadi, skaner ishlayveradi.
export default function ScannerPreview() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const scanner = useScanner();
  const videoRef = useRef(null);
  const stream = scanner?.stream;
  const shown = !scanner?.isPhone && !!scanner?.scanning && scanner.previewOpen && pathname !== "/qr-attendance";

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !shown) return;
    video.srcObject = stream;
    video.play().catch(() => {});
  }, [stream, shown]);

  if (!shown) return null;
  return (
    <div className="fixed z-30 right-3 bottom-20 lg:bottom-4 w-32 sm:w-44 aspect-[4/3] rounded-2xl overflow-hidden bg-slate-950 ring-1 ring-white/15 shadow-[0_8px_24px_-6px_rgba(15,23,42,0.45)]">
      <video ref={videoRef} playsInline muted className="size-full object-cover" />
      <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1.5 px-2 h-5 rounded-full bg-slate-950/70 text-[10px] font-semibold text-slate-100">
        <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
        {t("attendance.cameraLive")}
      </span>
      <button
        type="button"
        onClick={() => scanner.setPreviewOpen(false)}
        aria-label={t("common.close")}
        className="absolute top-1.5 right-1.5 size-6 flex items-center justify-center rounded-full bg-slate-950/70 text-white hover:bg-slate-950 cursor-pointer"
      >
        <HiXMark className="text-sm" />
      </button>
    </div>
  );
}
