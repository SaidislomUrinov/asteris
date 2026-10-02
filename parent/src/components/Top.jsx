import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { cn } from "../utils/cn";
import { useAuth } from "../contexts/auth";
import { patchSettings } from "../api/parent";
import { haptic } from "../lib/telegram";

const LANGS = ["uz", "ru", "en"];

// Doimiy yuqori panel: WENET logosi + til almashtirgich. Har ekranda
// (yuklanish, ulanmagan, asosiy) ko'rinadi.
export const Top = () => {
  const { t, i18n } = useTranslation();
  const { parent, setParent } = useAuth();
  const [busy, setBusy] = useState(false);
  const cur = (i18n.language || "uz").slice(0, 2);

  const change = async (lang) => {
    if (lang === cur || busy) return;
    haptic("light");
    i18n.changeLanguage(lang);
    if (!parent) return; // hali kirmagan — faqat lokal
    setBusy(true);
    try {
      setParent(await patchSettings({ lang }));
    } catch (e) {
      toast.error(t(e.code, { defaultValue: t("error.unknown") }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sticky top-0 z-30 bg-bg/85 backdrop-blur-md">
      <div className="max-w-lg mx-auto px-4 h-12 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <img src="/icon.svg" alt="WENET" className="w-6 h-6 shrink-0" />
          <span className="font-space font-semibold text-[17px] tracking-tight text-ink">WENET</span>
        </div>
        <div className="flex bg-ink/6 rounded-full p-0.5" role="group" aria-label={t("settings.lang")}>
          {LANGS.map((l) => (
            <button
              key={l}
              type="button"
              disabled={busy}
              onClick={() => change(l)}
              className={cn(
                "px-2.5 h-7 rounded-full text-[11px] font-bold uppercase tracking-wide transition-colors",
                cur === l ? "bg-card text-ink shadow-[0_1px_3px_rgba(15,23,42,0.10)]" : "text-hint",
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
