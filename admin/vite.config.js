import process from "node:process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
// https://vite.dev/config/
// Ishchi shell'da global `NODE_ENV=development` bor — u bilan `vite build`
// React'ning DEVELOPMENT nusxasini yig'ardi (≈2× katta va sekin).
if (process.argv.includes("build")) process.env.NODE_ENV = "production";

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
