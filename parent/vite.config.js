import process from "node:process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Ishchi shell'da global `NODE_ENV=development` bor — u bilan `vite build`
// React'ning DEVELOPMENT nusxasini yig'ardi (≈2× katta va sekin).
if (process.argv.includes("build")) process.env.NODE_ENV = "production";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5175,
    host: true,
    // Tunnel (cloudflared/ngrok) orqali ochilganda hostni tekshirmasin
    allowedHosts: true,
    // /api → lokal backend (VITE_API_URL=/api bo'lsa tunnel orqali ham ishlaydi)
    proxy: {
      "/api": { target: "http://127.0.0.1:5000", changeOrigin: true },
      // Ishchi paneli socket'i (VITE_API_URL=/api bo'lsa nisbiy ulanadi)
      "/socket.io": { target: "http://127.0.0.1:5000", changeOrigin: true, ws: true },
    },
  },
});
