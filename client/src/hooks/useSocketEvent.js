import { useEffect, useRef } from "react";
import socket from "../socket";

// Universal socket-obuna hook — istalgan sahifa/komponent istalgan socket
// hodisasiga (masalan "attendance:marked", kelajakda "payment:created" va
// h.k.) shu orqali obuna bo'ladi, mavjud `client/src/socket.js` (allaqachon
// ulangan va autentifikatsiyalangan) ustiga qurilgan — yangi ulanish
// yaratilmaydi. `handler` har render yangi funksiya bo'lsa ham obuna faqat
// bir marta (`event`/`enabled` o'zgarganda) qayta o'rnatiladi.
export function useSocketEvent(event, handler, enabled = true) {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!enabled || !event) return;

    const listener = (...args) => handlerRef.current?.(...args);
    socket.on(event, listener);
    return () => socket.off(event, listener);
  }, [event, enabled]);
}
