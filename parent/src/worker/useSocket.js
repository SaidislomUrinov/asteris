import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { API } from "../api/http";
import { getWorkerCenter, getWorkerToken, reauthWorker } from "./api";

// Client paneli bilan bir xil namespace (`/client`). `API` = ".../api" —
// socket server ildizida, shuning uchun `/api` qismi olib tashlanadi.
// Nisbiy `/api` bo'lsa (tunnel) joriy origin ishlatiladi (vite proxy
// `/socket.io` ni backendga uzatadi).
const ORIGIN = API.replace(/\/api\/?$/, "");

let socket = null;
const getSocket = () => {
  if (!socket) {
    socket = io(`${ORIGIN}/client`, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 3000,
      transports: ["websocket"],
      // Token FUNKSIYA — har qayta ulanishda eng yangi token o'qiladi
      // (bug_socket_auth_stale_token: statik obyekt eskirgan tokenda qolardi).
      auth: (cb) => cb({ token: getWorkerToken(), centerId: getWorkerCenter() }),
    });
  }
  return socket;
};

// Shell darajasida bir marta: ulanish + holat (Jonli / Oflayn).
export const useSocketConnection = () => {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const s = getSocket();
    let retried = false;
    const onConnect = () => {
      retried = false;
      setConnected(true);
    };
    const onDisconnect = () => setConnected(false);
    // Token muddati o'tgan bo'lsa — bir marta jim qayta kirib, qayta ulanamiz.
    const onError = async (err) => {
      setConnected(false);
      if (err?.message !== "Unauthorized" || retried) return;
      retried = true;
      try {
        await reauthWorker();
        s.connect();
      } catch {
        /* REST qatlami sessiya yo'qolganini o'zi bildiradi */
      }
    };
    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("connect_error", onError);
    s.connect();
    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("connect_error", onError);
      s.disconnect();
    };
  }, []);
  return connected;
};

// Bir yoki bir nechta eventga obuna. `handler` ref orqali — har renderda
// qayta obuna bo'lmaydi.
export const useSocketEvents = (events, handler) => {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  }, [handler]);
  const key = events.join("|");
  useEffect(() => {
    const s = getSocket();
    const list = key.split("|");
    const fns = list.map((ev) => {
      const fn = (payload) => ref.current?.(ev, payload);
      s.on(ev, fn);
      return [ev, fn];
    });
    return () => fns.forEach(([ev, fn]) => s.off(ev, fn));
  }, [key]);
};
