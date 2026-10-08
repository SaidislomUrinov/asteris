import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiCheckCircle,
  HiClock,
  HiLink,
  HiLinkSlash,
  HiPaperAirplane,
  HiQuestionMarkCircle,
} from "react-icons/hi2";
import Button from "../../ui/Button";
import IconButton from "../../ui/IconButton";
import Dialog from "../../ui/Dialog";
import Select from "../../ui/Select";

const LANG_OPTIONS = [
  { value: "uz", label: "🇺🇿 O'zbekcha" },
  { value: "ru", label: "🇷🇺 Русский" },
  { value: "en", label: "🇬🇧 English" },
];

/**
 * Integratsiya kartasi — hozircha faqat Telegram, lekin struktura
 * kelajakda boshqa integratsiyalar (email, SMS...) uchun ham qayta
 * ishlatilishi mumkin bo'lishi uchun props orqali ochiq qoldirilgan.
 *
 * Tushuntiruvchi matn endi doim ko'rinmaydi — "?" tugmasi orqali modal
 * ichida ochiladi, karta o'zi ixcham (nom + status + kichik tugma) qoladi.
 *
 * @param {boolean} [props.fullBleed] — mobilda karta ekran chetigacha
 *   cho'ziladi (`w-screen` + markazlash orqali — ota flex konteynerning
 *   `-mx` bilan mos kelmasligi muammosidan xoli, `Notifications`
 *   sahifasidagi `p-4` konteynerga qarab). `StaffProfile` kabi allaqachon
 *   o'z ustuniga joylashgan konteksda berilmaydi.
 */
function IntegrationCard({
  linked,
  loading,
  connecting,
  descriptionKey,
  lang,
  onConnect,
  onUnlinkRequest,
  onLangChange,
  fullBleed = false,
}) {
  const { t } = useTranslation();
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <>
      <div
        className={`flex flex-col gap-4 p-4 sm:p-5 border border-slate-200/70 dark:border-night-700/70 bg-white dark:bg-night-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none transition-shadow duration-200 hover:shadow-[0_2px_10px_rgba(15,23,42,0.06)] dark:hover:shadow-none ${
          fullBleed
            ? "w-screen relative left-1/2 -translate-x-1/2 rounded-none border-x-0 sm:w-full sm:max-w-2xl sm:static sm:translate-x-0 sm:rounded-2xl sm:border-x"
            : "w-full sm:max-w-2xl rounded-2xl"
        }`}
      >
        <div className="flex items-start gap-3">
          <span className="flex items-center justify-center w-11 h-11 sm:w-13 sm:h-13 shrink-0 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-white text-xl sm:text-2xl">
            <HiPaperAirplane className="-rotate-45" />
          </span>

          <div className="flex items-start justify-between gap-2 min-w-0 flex-1">
            <div className="flex flex-col gap-1.5 min-w-0">
              <p className="font-semibold text-slate-800 dark:text-slate-100">{t("telegram.title")}</p>

              {loading ? (
                <div className="h-5 w-24 rounded-full bg-slate-100 dark:bg-night-800 animate-pulse" />
              ) : linked ? (
                <span className="flex items-center gap-1.5 w-fit text-[13px] font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {t("telegram.linked")}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 w-fit text-[13px] font-medium text-slate-400 dark:text-slate-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-night-600" />
                  {t("telegram.notLinked")}
                </span>
              )}

              {!loading && (
                <div className="pt-0.5">
                  {linked ? (
                    <Button
                      color="red"
                      variant="outlined"
                      className="!min-h-9 !max-h-9 !px-3.5 gap-1.5 text-[11px] rounded-lg"
                      aria-label={t("telegram.unlink")}
                      onClick={onUnlinkRequest}
                    >
                      <HiLinkSlash className="text-sm" />
                      {t("telegram.unlink")}
                    </Button>
                  ) : (
                    <Button
                      color="blue"
                      loading={connecting}
                      className="!min-h-9 !max-h-9 !px-3.5 gap-1.5 text-[11px] rounded-lg"
                      aria-label={t("telegram.connect")}
                      onClick={onConnect}
                    >
                      {connecting ? <HiClock className="text-sm" /> : <HiLink className="text-sm" />}
                      {connecting ? t("telegram.waiting") : t("telegram.connect")}
                    </Button>
                  )}
                </div>
              )}
            </div>

            {!loading && (
              <IconButton
                variant="ghost"
                color="black"
                className="!min-w-7 !max-w-7 !min-h-7 !max-h-7 shrink-0 text-base"
                title={t("telegram.aboutTitle")}
                aria-label={t("telegram.aboutTitle")}
                onClick={() => setInfoOpen(true)}
              >
                <HiQuestionMarkCircle />
              </IconButton>
            )}
          </div>
        </div>

        {!loading && linked && (
          <div className="flex flex-col gap-2 pt-4 border-t border-slate-100 dark:border-night-700">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("telegram.langLabel")}</span>
                <span className="text-xs text-slate-400 dark:text-slate-500">{t("telegram.langDesc")}</span>
              </div>
              <Select
                className="w-full sm:w-44 shrink-0"
                variant="white"
                value={lang}
                onChange={onLangChange}
                options={LANG_OPTIONS}
              />
            </div>
          </div>
        )}
      </div>

      <Dialog open={infoOpen} onClose={() => setInfoOpen(false)} title={t("telegram.aboutTitle")}>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{t(descriptionKey)}</p>
      </Dialog>
    </>
  );
}

export default IntegrationCard;
