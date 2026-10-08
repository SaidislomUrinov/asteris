import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { HiArrowDownTray, HiOutlineQrCode, HiXMark } from "react-icons/hi2";
import { Button } from "../../components/Button";
import { Skeleton } from "../../components/Skeleton";
import { ErrorState } from "../../components/States";
import { useRequest } from "../../hooks/useRequest";
import { getQrCard, sendQrCard } from "../../api/parent";
import { applyTheme, getBackButtonHandler, haptic, setBackButton, setWhiteChrome } from "../../lib/telegram";

// Ekran temadan qat'i nazar oq — QR skaner uchun yuqori kontrast. Tailwind
// rang tokenlari shu konteyner ichida yorug' qiymatlarga almashtiriladi.
const LIGHT_VARS = {
  "--color-bg": "#ffffff",
  "--color-card": "#f1f5f9",
  "--color-ink": "#0f172a",
  "--color-hint": "#64748b",
  "--color-line": "#e2e8f0",
};

const errMsg = (t, e) => t(e?.code || "error.unknown", { defaultValue: t("error.unknown") });

const toBlob = (canvas) =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("attendance.qrInvalidImage"))), "image/png");
  });

// O'quvchining QR davomat kartasi — to'liq ekran (docs/API_CONTRACT_parent_qr_card.md §2).
// Ochilganda mount qilinadi (`{open && <QrCardSheet/>}`).
// `initial` — Group sahifasi tugmani ko'rsatish uchun olgan javob (qayta so'ralmaydi).
// "Yuklab olish" kartani bot orqali foydalanuvchining o'z Telegram chatiga yuboradi.
export const QrCardSheet = ({ onClose, entryId, initial }) => {
  const { t } = useTranslation();
  const [sending, setSending] = useState(false);
  const canvasRef = useRef(null);
  const sendingRef = useRef(false);
  const firstRef = useRef(true);

  // Karta chizgich (+ `qrcode`) faqat ekran ochilganda yuklanadi.
  const build = useCallback(
    async (useInitial) => {
      const [d, { renderQrCard }] = await Promise.all([
        useInitial && initial ? initial : getQrCard(entryId),
        import("../../lib/qrCard"),
      ]);
      const canvas = await renderQrCard(
        {
          fullName: d.fullName,
          qrToken: d.qrToken,
          centerName: d.center?.name,
          centerLogo: d.center?.logo,
          groups: d.groups,
        },
        t,
      );
      canvasRef.current = canvas;
      return canvas.toDataURL("image/png");
    },
    [entryId, initial, t],
  );

  // Birinchi chizishda Group olgan javob ishlatiladi, "Qayta urinish" esa
  // serverdan yangidan so'raydi.
  const card = useRequest(() => {
    const useInitial = firstRef.current;
    firstRef.current = false;
    return build(useInitial);
  }, [build]);
  const src = card.data || "";

  const close = useCallback(() => {
    if (!sendingRef.current) onClose();
  }, [onClose]);

  // Telegram BackButton / ESC yopadi; oq sarlavha; yopilgach sahifaning
  // o'z "orqaga" amali va temasi qaytariladi.
  useEffect(() => {
    const prevBack = getBackButtonHandler();
    setBackButton(true, close);
    setWhiteChrome();
    const onKey = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      setBackButton(!!prevBack, prevBack);
      applyTheme();
      document.body.style.overflow = prevOverflow;
    };
  }, [close]);

  const send = async () => {
    const canvas = canvasRef.current;
    if (!canvas || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    haptic("medium");
    try {
      const blob = await toBlob(canvas);
      await sendQrCard(entryId, blob);
      haptic("success");
      toast.success(t("group.qrCard.sent"));
    } catch (e) {
      haptic("error");
      toast.error(errMsg(t, e));
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("group.qrCard.title")}
      className="fixed inset-0 z-50 bg-white text-ink flex flex-col animate-dialog-in"
      style={{ ...LIGHT_VARS, paddingTop: "env(safe-area-inset-top)" }}
    >
      <header className="flex items-center justify-between gap-3 px-5 pt-3 pb-2 shrink-0">
        <div className="text-lg font-extrabold leading-tight min-w-0 truncate">{t("group.qrCard.title")}</div>
        <button
          type="button"
          onClick={close}
          aria-label={t("group.qrCard.close")}
          className="w-10 h-10 -mr-1.5 rounded-full bg-card grid place-items-center text-hint shrink-0"
        >
          <HiXMark className="w-5 h-5" />
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-6 flex flex-col items-center justify-center gap-5">
        {card.loading ? (
          <Skeleton className="w-full max-w-lg aspect-[856/540] rounded-2xl" />
        ) : card.error ? (
          <ErrorState error={card.error} onRetry={() => card.reload()} />
        ) : (
          <img
            src={src}
            alt={t("group.qrCard.title")}
            className="w-full max-w-lg h-auto rounded-2xl shadow-[0_8px_30px_rgba(15,23,42,0.14)] ring-1 ring-line select-none"
            draggable={false}
          />
        )}
        {!card.error && (
          <div className="flex items-center gap-2 text-[15px] font-semibold text-hint text-center max-w-xs">
            <HiOutlineQrCode className="w-5 h-5 shrink-0" />
            {t("group.qrCard.hint")}
          </div>
        )}
      </div>

      <footer className="px-5 pt-2 shrink-0" style={{ paddingBottom: "calc(14px + env(safe-area-inset-bottom))" }}>
        <Button className="min-h-14 text-base rounded-2xl" onClick={send} loading={sending} disabled={!src || card.loading || !!card.error}>
          {!sending && <HiArrowDownTray className="w-5 h-5 shrink-0" />}
          {t(sending ? "group.qrCard.sending" : "group.qrCard.download")}
        </Button>
        <div className="text-[13px] text-hint text-center mt-2.5">{t("group.qrCard.downloadHint")}</div>
      </footer>
    </div>
  );
};
