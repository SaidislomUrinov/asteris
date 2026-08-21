import { io } from "socket.io-client";
import { API } from "./utils/fetching";

const socket = io(`${API}/admin`, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 3000,
  transports: ["websocket"],
});

export default socket;
