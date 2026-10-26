import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiCamera,
  HiCheckCircle,
  HiClock,
  HiCommandLine,
  HiExclamationTriangle,
  HiFaceSmile,
  HiVideoCameraSlash,
  HiXCircle,
} from "react-icons/hi2";
import Avatar from "../../ui/Avatar";
import ScanFaceIcon from "../../ui/ScanFaceIcon";
import { useScanner } from "../../contexts/scanner";

// Skan natijasining vizual holati bitta joyda — natija banneri, tarix
// qatoridagi belgi va statistika kartochkalari shu jadvalga tayanadi,
// shuning uchun ranglar hech qachon bir-biridan farq qilib qolmaydi.
const TONE = {
  present: {
    icon: HiCheckCircle,
    banner: "bg-emerald-50 dark:bg-emerald-500/15 ring-emerald-200/70 dark:ring-emerald-500/30 text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
    chip: "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  late: {
    icon: HiClock,
    banner: "bg-orange-50 dark:bg-orange-500/15 ring-orange-200/70 dark:ring-orange-500/30 text-orange-700 dark:text-orange-400",
    dot: "bg-orange-500",
    text: "text-orange-600 dark:text-orange-400",
    chip: "bg-orange-50 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400",
  },
  duplicate: {
    icon: HiExclamationTriangle,
    banner: "bg-amber-50 dark:bg-amber-500/15 ring-amber-200/70 dark:ring-amber-500/30 text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    chip: "bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  failed: {
    icon: HiXCircle,
    banner: "bg-red-50 dark:bg-red-500/15 ring-red-200/70 dark:ring-red-500/30 text-red-700 dark:text-red-400",
    dot: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
    chip: "bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400",
  },
};

const toneOf = (item) =>
  item?.failed ? "failed" : item?.duplicate ? "duplicate" : item?.late ? "late" : "present";

const clockOf = (ms) =>
  new Date(ms).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });

// QR orqali davomat (CLAUDE.md tarif flagi `attendance.qr`): o'quvchi o'z
// doimiy QR kartasini ko'rsatadi, Reception/Teacher shu sahifada kamera
// bilan skanerlaydi. Yozuvni server qo'yadi (`POST /attendance/qr/scan`) —
// dars kuni, guruh a'zoligi va kechikish tekshiruvlari o'sha yerda.
//
// Sahifa "davomat terminali" sifatida qurilgan: skaner maydoni asosiy
// qahramon (chapda ~60%), o'ngda esa jonli skanlar tasmasi. Motion faqat
// JONLI HOLAT ko'rsatkichlari uchun (o'qish chizig'i, muvaffaqiyat
// chaqnashi) — CLAUDE.md dagi "kirish animatsiyasi yo'q" qoidasiga mos.
function QrAttendance() {
  const { t } = useTranslation();

  // Kamera, tarix va natija Top'dagi tugma bilan boshqariladigan umumiy
  // skanerdan keladi (contexts/ScannerContext.jsx) — sahifa faqat ko'rsatadi.
  const { faceOn, face, scanning, stream, cameraError, result, history, scannerSeen, start, stop } = useScanner();

  const videoRef = useRef(null);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    if (stream) video.play().catch(() => {});
  }, [stream]);

  // Bugungi jamlanma — faqat shu seansdagi skanlardan (tarix 20 tagacha).
  const stats = useMemo(
    () => ({
      total: history.filter((h) => !h.failed).length,
      present: history.filter((h) => !h.failed && !h.duplicate && !h.late).length,
      late: history.filter((h) => !h.failed && !h.duplicate && h.late).length,
      failed: history.filter((h) => h.failed).length,
    }),
    [history],
  );

  const resultTone = result ? TONE[toneOf(result)] : null;
  const ResultIcon = resultTone?.icon;
  // Har muvaffaqiyatli skanda kadr chekkasi bir marta yashil chaqnaydi.
  // `key` almashgani uchun element qayta o'rnatiladi va animatsiya
  // boshidan ijro etiladi.
  const flashKey = history[0]?.at || 0;

  // Kamera ustidagi katta natija kartasi ~2.5 soniya turadi — operator
  // ekranga uzoqdan qarab ham natijani ko'radi, keyin navbatdagi skan uchun
  // kadr yana ochiladi.
  const [overlayAt, setOverlayAt] = useState(0);
  useEffect(() => {
    if (!result?.at) return undefined;
    const show = setTimeout(() => setOverlayAt(result.at), 0);
    const hide = setTimeout(() => setOverlayAt(0), 2500);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [result?.at]);
  const showOverlay = !!result && overlayAt === result.at;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Sarlavha ──────────────────────────────────────────────────────
          Sahifaning "shaxsi": qorong'i terminal bandi, o'ngda kamera va
          Barcode (Skayner) holati jonli badge'lar bo'lib turadi. */}
      <div className="order-1 relative overflow-hidden rounded-2xl bg-slate-900 px-4 py-4 sm:px-6 sm:py-5">
        <div className="absolute -top-20 -right-8 w-64 h-64 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute -bottom-24 left-24 w-56 h-56 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 shrink-0 rounded-2xl bg-white/10 ring-1 ring-white/10 flex items-center justify-center text-white text-2xl">
              <ScanFaceIcon />
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="font-space font-bold text-xl text-white truncate">
                {t("attendance.qrTitle")}
              </h1>
              {/* Mobil ekranda uzun matn kesilmasin — o'raladi, kattasida esa
                  sarlavha bandi bir qatorda qoladi. */}
              <p className="text-sm text-slate-400 dark:text-slate-500 lg:truncate">{t("attendance.qrSubtitle")}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <StatusPill
              on={scanning}
              label={scanning ? t("attendance.cameraLive") : t("attendance.cameraOff")}
            />
            {faceOn && (
              <StatusPill
                on={face.status === "ready"}
                icon={<HiFaceSmile className="text-sm" />}
                label={
                  face.status === "error"
                    ? t("attendance.faceError")
                    : face.status === "ready"
                      ? t("attendance.faceReady", { done: face.done, total: face.total })
                      : t("attendance.faceLoading")
                }
              />
            )}
            <StatusPill
              on={scannerSeen}
              icon={<HiCommandLine className="text-sm" />}
              label={scannerSeen ? t("attendance.scannerActive") : t("attendance.scannerReady")}
            />
          </div>
        </div>
      </div>

      {/* ── Bugungi jamlanma — ixcham qator ─────────────────────────────── */}
      <div className="order-3 lg:order-2 grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <StatCard label={t("attendance.statTotal")} value={stats.total} tone="text-slate-900 dark:text-slate-100" />
        <StatCard
          label={t("attendance.presentShort")}
          value={stats.present}
          tone="text-emerald-600 dark:text-emerald-400"
        />
        <StatCard label={t("attendance.lateShort")} value={stats.late} tone="text-orange-600 dark:text-orange-400" />
        <StatCard label={t("attendance.scanErrorShort")} value={stats.failed} tone="text-red-600 dark:text-red-400" />
      </div>

      {/* ── Asosiy maydon: skaner (~62%) + jonli tasma (~38%) ───────────── */}
      <div className="order-2 lg:order-3 grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4 items-start">
        <div className="flex flex-col gap-3">
          {/* Kamera maydoni ataylab jilovlangan (`max-w-sm`) — QR kartani
              o'qish uchun katta oyna shart emas, ortiqcha joy operatorni
              chalg'itadi. Tugma va natija banneri ham shu kenglikda
              tekislanadi. */}
          <div className="flex flex-col items-center p-3 sm:p-4 rounded-2xl bg-white dark:bg-night-900 ring-1 ring-slate-200/70 dark:ring-night-700/70 shadow-[0_1px_3px_rgba(15,23,42,0.05)] dark:shadow-none">
            <div className="relative w-full max-w-2xl aspect-square sm:aspect-[4/3] rounded-2xl overflow-hidden bg-slate-950">
              <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />

              {/* Kamera o'chiq — katta QR belgisi va nima qilish kerakligi */}
              {!scanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950">
                  <div
                    className={`w-20 h-20 rounded-3xl flex items-center justify-center text-4xl ring-1 ${
                      cameraError
                        ? "bg-red-500/10 text-red-400 ring-red-400/20"
                        : "bg-white/5 dark:bg-night-900/5 text-slate-400 dark:text-slate-500 ring-white/10 dark:ring-night-900/10"
                    }`}
                  >
                    {cameraError ? <HiVideoCameraSlash /> : <ScanFaceIcon />}
                  </div>
                  <p
                    className={`text-sm max-w-xs ${cameraError ? "text-red-300" : "text-slate-400 dark:text-slate-500"}`}
                  >
                    {cameraError || t("attendance.cameraIdle")}
                  </p>
                </div>
              )}

              {/* Nishon ramkasi — 4 yoritilgan burchak + o'qish chizig'i
                  (faqat kamera yoqilganda; jonli holat ko'rsatkichi,
                  kirish animatsiyasi emas). */}
              {scanning && (
                <>
                  <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-slate-950/40 via-transparent to-slate-950/60" />
                  <div className="absolute inset-[12%] pointer-events-none">
                    {[
                      "top-0 left-0 border-t-3 border-l-3 rounded-tl-xl",
                      "top-0 right-0 border-t-3 border-r-3 rounded-tr-xl",
                      "bottom-0 left-0 border-b-3 border-l-3 rounded-bl-xl",
                      "bottom-0 right-0 border-b-3 border-r-3 rounded-br-xl",
                    ].map((pos) => (
                      <span
                        key={pos}
                        className={`absolute w-10 h-10 border-blue-400/90 shadow-[0_0_16px_rgba(96,165,250,0.45)] ${pos}`}
                      />
                    ))}
                    <span className="absolute left-2 right-2 h-0.5 rounded-full bg-blue-400 shadow-[0_0_12px_2px_rgba(96,165,250,0.8)] animate-scan-line" />
                  </div>

                  <span className="absolute bottom-3 left-3 flex items-center gap-2 px-3 h-8 rounded-full bg-slate-950/70 backdrop-blur text-[11px] font-semibold text-slate-200 ring-1 ring-white/10 dark:ring-night-900/10">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    {faceOn ? t("attendance.waitingQrFace") : t("attendance.waitingQr")}
                  </span>
                  <span className="absolute bottom-3 right-3 hidden sm:block text-[11px] text-slate-400 dark:text-slate-500">
                    {t("attendance.scanReadyHint")}
                  </span>
                </>
              )}

              {/* Natija kartasi — kamera ustida, katta va aniq */}
              {showOverlay && (
                <div className="absolute inset-0 flex items-center justify-center p-5 bg-slate-950/55 backdrop-blur-[2px] pointer-events-none">
                  <div className="flex flex-col items-center gap-2 w-full max-w-xs px-5 py-5 rounded-2xl bg-white dark:bg-night-900 text-center shadow-[0_8px_24px_-6px_rgba(15,23,42,0.35)] dark:shadow-none">
                    <span
                      className={`w-14 h-14 rounded-full flex items-center justify-center text-3xl ${resultTone.chip}`}
                    >
                      <ResultIcon />
                    </span>
                    <p className="font-space font-bold text-lg text-slate-900 dark:text-slate-100 leading-tight line-clamp-2">
                      {result.failed ? t("attendance.scanFailed") : result.student?.fullName}
                    </p>
                    <p className={`text-sm font-medium ${resultTone.text}`}>
                      {result.failed
                        ? t(result.message || "attendance.scanFailed")
                        : result.duplicate
                          ? t("attendance.alreadyMarked")
                          : result.late
                            ? t("attendance.markedLate")
                            : t("attendance.marked")}
                    </p>
                    {!result.failed && result.subject && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-full">{result.subject}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Muvaffaqiyatli skan — kadr chekkasi bir lahza yashil
                  chaqnaydi (natija ko'rsatkichi). */}
              {flashKey > 0 && (
                <span
                  key={flashKey}
                  className="absolute inset-0 pointer-events-none rounded-2xl animate-scan-flash"
                />
              )}
            </div>

            {/* Asosiy amal — kattaligi bilan ajralib turadi */}
            <div className="w-full max-w-2xl mt-3">
              {scanning ? (
                <button
                  type="button"
                  onClick={stop}
                  className="flex items-center justify-center gap-2 w-full h-12 rounded-xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-night-800 hover:text-slate-800 dark:hover:text-slate-100 cursor-pointer transition-colors duration-150"
                >
                  <HiVideoCameraSlash className="text-lg" />
                  {t("attendance.stopScan")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={start}
                  className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold shadow-lg shadow-blue-600/20 hover:from-blue-500 hover:to-blue-400 hover:shadow-blue-600/30 active:scale-[0.995] cursor-pointer transition-all duration-150"
                >
                  <HiCamera className="text-lg" />
                  {t("attendance.startScan")}
                </button>
              )}
            </div>

            {/* Oxirgi natija — kattaroq, avatar bilan: operator ekranga
                uzoqdan qarab ham kim skanerlanganini ko'radi. */}
            {result && (
              <div
                className={`flex items-center gap-3 w-full max-w-2xl mt-3 p-3 rounded-2xl ring-1 ${resultTone.banner}`}
              >
                {result.failed ? (
                  <div className="w-11 h-11 shrink-0 rounded-full bg-white/60 dark:bg-night-900/60 flex items-center justify-center text-2xl">
                    <ResultIcon />
                  </div>
                ) : (
                  <Avatar
                    user={{
                      _id: result.student?._id,
                      name: result.student?.fullName,
                      avatar: result.student?.photo,
                    }}
                    size={44}
                  />
                )}
                <div className="flex flex-col min-w-0 flex-1">
                  <p className="font-semibold truncate">
                    {result.student?.fullName || t("attendance.scanFailed")}
                  </p>
                  <p className="text-xs opacity-80 truncate">
                    {(result.failed && t(result.message || "attendance.scanFailed")) ||
                      result.subject ||
                      (result.duplicate
                        ? t("attendance.alreadyMarked")
                        : result.late
                          ? t("attendance.markedLate")
                          : !result.failed && t("attendance.marked"))}
                  </p>
                </div>
                {!result.failed && <ResultIcon className="text-2xl shrink-0" />}
              </div>
            )}
          </div>

          {/* Apparat skaner doim tinglanadi — kamera yoqilmagan bo'lsa ham.
              Bu yerda faqat holat ko'rsatiladi, hech narsa bosish shart emas. */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white dark:bg-night-900 ring-1 ring-slate-200/70 dark:ring-night-700/70">
            <div
              className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${
                scannerSeen ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-slate-50 dark:bg-night-800 text-slate-400 dark:text-slate-500"
              }`}
            >
              <HiCommandLine className="text-lg" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                {scannerSeen ? t("attendance.scannerActive") : t("attendance.scannerReady")}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                {t("attendance.scannerHint")}
              </span>
            </div>
            <span
              className={`w-2 h-2 shrink-0 rounded-full ${
                scannerSeen ? "bg-emerald-500" : "bg-slate-300 dark:bg-night-600"
              }`}
            />
          </div>
        </div>

        {/* ── Jonli tasma ─────────────────────────────────────────────── */}
        <div className="flex flex-col rounded-2xl bg-white dark:bg-night-900 ring-1 ring-slate-200/70 dark:ring-night-700/70 shadow-[0_1px_3px_rgba(15,23,42,0.05)] dark:shadow-none overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 dark:border-night-700">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {t("attendance.scanHistory")}
            </p>
            {history.length > 0 && (
              <span className="flex items-center justify-center min-w-6 h-6 px-2 rounded-lg bg-slate-100 dark:bg-night-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                {history.length}
              </span>
            )}
          </div>

          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-20 px-6 text-center">
              <div className="w-16 h-16 rounded-3xl bg-slate-50 dark:bg-night-800 flex items-center justify-center text-3xl text-slate-300 dark:text-slate-600">
                <ScanFaceIcon />
              </div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                {t("attendance.scanHistoryEmpty")}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 max-w-56">{t("attendance.scanHistoryHint")}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5 p-2 max-h-[32rem] overflow-y-auto">
              {history.map((item, i) => {
                const tone = TONE[toneOf(item)];
                const Icon = tone.icon;
                return (
                  <div
                    key={`${item.student?._id}-${item.at}-${i}`}
                    className="flex items-center gap-3 px-2.5 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-night-800 transition-colors duration-150"
                  >
                    {item.failed ? (
                      <span className="w-[38px] h-[38px] shrink-0 rounded-full bg-red-50 dark:bg-red-500/15 text-red-500 flex items-center justify-center text-xl">
                        <Icon />
                      </span>
                    ) : (
                      <Avatar
                        user={{
                          _id: item.student?._id,
                          name: item.student?.fullName,
                          avatar: item.student?.photo,
                        }}
                        size={38}
                      />
                    )}
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-semibold text-slate-800 dark:text-slate-100 truncate leading-snug">
                        {item.failed ? t(item.message || "attendance.scanFailed") : item.student?.fullName}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 truncate leading-snug">
                        {item.subject && (
                          <>
                            <span className="truncate">{item.subject}</span>
                            <span className="w-1 h-1 shrink-0 rounded-full bg-slate-300 dark:bg-night-600" />
                          </>
                        )}
                        {clockOf(item.at)}
                        <span className="w-1 h-1 shrink-0 rounded-full bg-slate-300 dark:bg-night-600" />
                        {/* Qaysi usulda o'qilgani — skanerni sozlashda foydali */}
                        {item.via === "scanner"
                          ? t("attendance.viaScanner")
                          : item.via === "face"
                            ? t("attendance.viaFace")
                            : t("attendance.viaCamera")}
                      </span>
                    </div>
                    <span
                      className={`flex items-center gap-1 shrink-0 px-2 h-6 rounded-lg text-[11px] font-semibold ${tone.chip}`}
                    >
                      <Icon className="text-sm" />
                      {item.failed
                        ? t("attendance.scanErrorShort")
                        : item.duplicate
                        ? t("attendance.alreadyMarkedShort")
                        : item.late
                          ? t("attendance.lateShort")
                          : t("attendance.presentShort")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

// Sarlavhadagi holat badge'i — yashil = jonli, kulrang = kutilmoqda.
function StatusPill({ on, icon, label }) {
  return (
    <span
      className={`flex items-center gap-2 h-9 px-3 rounded-full text-xs font-semibold ring-1 backdrop-blur-sm ${
        on
          ? "bg-emerald-500/15 text-emerald-300 ring-emerald-400/20"
          : "bg-white/5 dark:bg-night-900/5 text-slate-300 dark:text-slate-600 ring-white/10 dark:ring-night-900/10"
      }`}
    >
      {icon || (
        <span
          className={`w-1.5 h-1.5 rounded-full ${on ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`}
        />
      )}
      {label}
    </span>
  );
}

// Ixcham statistika — yorliq chapda, raqam o'ngda (balandligi past).
function StatCard({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-white dark:bg-night-900 ring-1 ring-slate-200/70 dark:ring-night-700/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
        {label}
      </span>
      <span className={`text-2xl font-space font-semibold tabular-nums leading-none ${tone}`}>
        {value}
      </span>
    </div>
  );
}

export default QrAttendance;
