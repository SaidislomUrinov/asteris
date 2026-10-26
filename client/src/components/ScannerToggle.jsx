import { useTranslation } from "react-i18next";
import ScanFaceIcon from "../ui/ScanFaceIcon";
import { useScanner } from "../contexts/scanner";

// Top panelda doimiy kamera skanerini yoqish/o'chirish (yonida ThemeToggle/"?"
// bilan bir xil ko'rinish). Yashil nuqta — kamera jonli.
export default function ScannerToggle() {
  const { t } = useTranslation();
  const scanner = useScanner();
  if (!scanner?.available || scanner.isPhone) return null;
  const { scanning, cameraIssue, start, stop } = scanner;
  const lost = !scanning && cameraIssue === "lost";
  const label = lost ? t("attendance.camera_lost_title") : t(scanning ? "attendance.stopScan" : "attendance.startScan");
  return (
    <button
      type="button"
      onClick={scanning ? stop : start}
      title={label}
      aria-label={label}
      aria-pressed={scanning}
      className={`relative flex items-center justify-center size-9 shrink-0 rounded-lg hover:bg-white/10 cursor-pointer transition-colors ${
        scanning ? "text-white" : "text-white/70 hover:text-white"
      }`}
    >
      <ScanFaceIcon size={22} />
      {scanning && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-emerald-400 ring-2 ring-[#0b2050] animate-pulse" />}
      {/* Kamera uzilgan: qotib turgan (miltillamaydigan) ogohlantirish nuqtasi */}
      {lost && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-amber-400 ring-2 ring-[#0b2050]" />}
    </button>
  );
}
