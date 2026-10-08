import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { HiSignal, HiSignalSlash } from "react-icons/hi2";
import socket from "../socket";

// Ulanish holati uchun ranglar — sidebar qorong'i fonda turgani uchun
// to'ldirish o'rniga yumshoq tint + chegara ishlatiladi.
const TONES = {
  online: {
    wrap: "border-emerald-500/25 bg-emerald-500/10",
    dot: "bg-emerald-400",
    text: "text-emerald-300",
  },
  reconnecting: {
    wrap: "border-amber-500/25 bg-amber-500/10",
    dot: "bg-amber-400",
    text: "text-amber-300",
  },
  offline: {
    wrap: "border-red-500/25 bg-red-500/10",
    dot: "bg-red-400",
    text: "text-red-300",
  },
};

// Socket ulanishi va uning vizual holati — ilgari Top.jsx da edi, endi
// Navbar'da "Asosiy" sarlavhasi tepasida, FAQAT ulanish yo'q paytda. Ulanishning o'zi ham shu
// yerda boshqariladi: komponent butun sessiya davomida mount holatida
// qoladigan yagona joyda (sidebar) yashaydi.
export default function SocketStatus() {
  const { t } = useTranslation();
  const { _id } = useSelector((e) => e.user);
  // Remount bo'lganda socket allaqachon ulangan bo'lishi mumkin — u holda
  // "connect" boshqa otilmaydi, shuning uchun boshlang'ich holat socketning
  // o'zidan o'qiladi, aks holda badge abadiy sariq qolib ketardi.
  const [status, setStatus] = useState(() =>
    socket.connected ? "online" : "reconnecting",
  );

  useEffect(() => {
    if (!_id) return;
    // Funksiya sifatida — access token qisqa umrli va axios interceptor uni
    // fonda yangilab localStorage'ga yozadi; statik obyekt bo'lsa socket har
    // reconnect urinishida ESKI tokenni yuborib, abadiy "reconnecting"
    // holatida qolib ketardi.
    socket.auth = (cb) => cb({ token: localStorage.getItem("access") });
    if (!socket.connected) socket.connect();

    const onConn = () => setStatus("online");
    const onDisc = () => setStatus("offline");
    // MUHIM: manager'ning "reconnect" eventi qayta ulanish TUGAGACH va
    // "connect" dan KEYIN otiladi — uni "reconnecting" ga bog'lash har qayta
    // ulanishdan so'ng holatni sariqda qotirib qo'yardi. Urinish boshlanishini
    // bildiradigan event — "reconnect_attempt".
    const onReconnAttempt = () => setStatus("reconnecting");
    const onConnError = () => setStatus("offline");

    socket.on("connect", onConn);
    socket.on("disconnect", onDisc);
    socket.on("connect_error", onConnError);
    socket.io.on("reconnect_attempt", onReconnAttempt);

    // socket.io o'zining reconnection backoff'iga tayanadi, lekin uzilishni
    // faqat ping-timeout orqali (o'nlab soniyada) sezadi va internet
    // qaytganini alohida bilmaydi — shu sabab internet uzilib-qaytganda
    // yoki fon(background)dagi tab qayta faollashganda ulanish uzoq vaqt
    // "reconnecting"da osilib qolishi mumkin edi. Ikkala hodisada ham darhol
    // qayta ulanishga urinamiz (socket.connect() allaqachon ulangan bo'lsa
    // hech narsa qilmaydi — xavfsiz).
    const forceReconnect = () => {
      if (!socket.connected) socket.connect();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") forceReconnect();
    };
    window.addEventListener("online", forceReconnect);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      socket.off("connect", onConn);
      socket.off("disconnect", onDisc);
      socket.off("connect_error", onConnError);
      socket.io.off("reconnect_attempt", onReconnAttempt);
      window.removeEventListener("online", forceReconnect);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [_id]);

  // Ulanish joyida bo'lsa hech narsa ko'rsatilmaydi — badge faqat muammo
  // (uzilish/qayta ulanish) paytida chiqadi. Sahifa ochilishidagi qisqa
  // ulanish vaqti miltillamasligi uchun 2s kutiladi.
  const [showProblem, setShowProblem] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setShowProblem(status !== "online"), status === "online" ? 0 : 2000);
    return () => clearTimeout(id);
  }, [status]);

  if (status === "online" || !showProblem) return null;

  const tone = TONES[status];
  const Icon = status === "offline" ? HiSignalSlash : HiSignal;

  return (
    <div
      className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl border ${tone.wrap}`}
    >
      <span className="relative flex items-center justify-center w-2 h-2 shrink-0">
        {status !== "offline" && (
          <span
            className={`absolute w-2 h-2 rounded-full animate-ping opacity-75 ${tone.dot}`}
          />
        )}
        <span className={`relative w-2 h-2 rounded-full ${tone.dot}`} />
      </span>
      <span className={`text-[12px] font-semibold truncate ${tone.text}`}>
        {t(`socket.${status}`)}
      </span>
      <Icon className={`ml-auto shrink-0 text-[16px] opacity-70 ${tone.text}`} />
    </div>
  );
}
