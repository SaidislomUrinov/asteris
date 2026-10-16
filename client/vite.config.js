import process from "node:process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Kam o'zgaradigan asosiy kutubxonalar alohida `vendor` chunk'ida — har
// deploy'da faqat ilova kodi yangilanadi, vendor brauzer keshida qoladi.
// Og'ir, faqat ayrim sahifada kerak bo'ladigan kutubxonalar (recharts,
// jspdf, jsqr...) bu yerga kirmaydi — ular lazy sahifa/amal bilan yuklanadi.
const VENDOR_RE =
  /[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|react-redux|@reduxjs|redux|redux-thunk|immer|reselect|use-sync-external-store|i18next|react-i18next|axios|socket\.io-client|socket\.io-parser|engine\.io-client|engine\.io-parser|@socket\.io|sonner)[\\/]/;

// Ishchi shell'da global `NODE_ENV=development` bor — u bilan `vite build`
// React/router'ning DEVELOPMENT nusxasini yig'ardi (≈2× katta va sekin).
// Build har doim production rejimida bo'lishi shart.
if (process.argv.includes("build")) process.env.NODE_ENV = "production";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (VENDOR_RE.test(id)) return "vendor";
        },
      },
    },
  },
});
