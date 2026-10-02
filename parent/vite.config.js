import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5175,
    host: true,
    // Tunnel (cloudflared/ngrok) orqali ochilganda hostni tekshirmasin
    allowedHosts: true,
    // /api → lokal backend (VITE_API_URL=/api bo'lsa tunnel orqali ham ishlaydi)
    proxy: { "/api": { target: "http://127.0.0.1:5000", changeOrigin: true } },
  },
});
