import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import "./index.css";
import "./i18n";
import { bootTelegram } from "./lib/telegram";
import { AuthProvider } from "./contexts/auth";
import App from "./App.jsx";

bootTelegram();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster
          position="top-center"
          // client bilan bir xil uslub: neytral karta, holat faqat ikonka rangida
          toastOptions={{
            classNames: {
              toast: "!rounded-2xl !bg-card !text-ink !border-line !shadow-[0_8px_24px_-8px_rgba(15,23,42,0.18)] !font-[inherit]",
              title: "!font-semibold",
              description: "!text-hint",
              success: "[&_[data-icon]]:!text-ok",
              error: "[&_[data-icon]]:!text-bad",
              warning: "[&_[data-icon]]:!text-warn",
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
