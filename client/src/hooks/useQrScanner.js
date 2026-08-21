import { useEffect, useRef } from "react";
import { isAnyDialogOpen } from "../utils/dialogState";

// --- Apparat (USB/Bluetooth) QR skaner ---
// Bunday skanerlar "keyboard wedge" tamoyilida ishlaydi: QR ni o'qib,
// matnni KLAVIATURADAN yozgandek kiritadi va odatda oxirida Enter yuboradi.
// Shuning uchun input maydoni EMAS, `document` bo'yicha keydown tinglanadi —
// fokus qayerda turganidan qat'iy nazar ishlaydi (qabulxonada hech kim
// maydonga bosib turmaydi).
//
// Odam yozuvidan farqlash — TEZLIK bo'yicha: skaner belgilarni bir-biridan
// ~10-20ms oraliqda yuboradi, odam esa hech qachon 50ms dan tez emas.
// Oraliq kattaroq bo'lsa bufer tozalanadi, ya'ni odam yozgani hech qachon
// to'planib qolmaydi.
const SCANNER_MAX_GAP = 50; // ms — belgilar orasidagi maksimal "mashina" oralig'i
// Enter yubormaydigan skanerlar ham bor — shuncha jimlikdan keyin bufer
// o'z-o'zidan yuboriladi.
const SCANNER_IDLE_FLUSH = 150; // ms
const MIN_TOKEN_LENGTH = 8; // tasodifiy bitta-ikkita belgi yuborilmasligi uchun

/**
 * Apparat skanerdan o'qilgan tokenni ushlaydi.
 *
 * @param {(token: string) => void} onToken - to'liq token o'qilganda chaqiriladi
 * @param {boolean} [enabled=true] - false bo'lsa tinglash umuman ulanmaydi
 */
export default function useQrScanner(onToken, enabled = true) {
  // Callback har renderda yangilanadi, lekin tinglovchi qayta ulanmasligi
  // kerak — shuning uchun ref orqali.
  const onTokenRef = useRef(onToken);
  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!enabled) return;

    let buffer = "";
    let lastKeyAt = 0;
    let idleTimer = 0;

    const flush = () => {
      clearTimeout(idleTimer);
      const token = buffer;
      buffer = "";
      if (token.length < MIN_TOKEN_LENGTH) return;
      onTokenRef.current?.(token);
    };

    const onKeyDown = (e) => {
      // Modal ochiq bo'lsa aralashmaymiz — foydalanuvchi forma to'ldirayotgan
      // yoki tasdiqlash kutayotgan bo'lishi mumkin.
      if (isAnyDialogOpen()) return;
      // Foydalanuvchi biror maydonga yozayotgan bo'lsa ham.
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;

      if (e.key === "Enter" || e.key === "Tab") {
        if (buffer.length >= MIN_TOKEN_LENGTH) {
          e.preventDefault(); // Tab fokusni sakratmasin
          flush();
        }
        return;
      }

      if (e.key.length !== 1 || e.ctrlKey || e.altKey || e.metaKey) return;

      const now = Date.now();
      // Oraliq katta — bu odam yozuvi, bufer noldan boshlanadi.
      if (now - lastKeyAt > SCANNER_MAX_GAP) buffer = "";
      buffer += e.key;
      lastKeyAt = now;

      clearTimeout(idleTimer);
      idleTimer = setTimeout(flush, SCANNER_IDLE_FLUSH);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      clearTimeout(idleTimer);
    };
  }, [enabled]);
}
