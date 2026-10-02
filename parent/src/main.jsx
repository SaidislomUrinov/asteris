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
        <Toaster position="top-center" richColors />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
