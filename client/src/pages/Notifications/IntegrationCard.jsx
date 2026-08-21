import { useTranslation } from "react-i18next";
import {
  HiArrowTopRightOnSquare,
  HiCheckCircle,
  HiClock,
  HiLink,
  HiLinkSlash,
  HiPaperAirplane,
} from "react-icons/hi2";
import Button from "../../ui/Button";
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
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4 p-5 sm:p-6 rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <span className="flex items-center justify-center w-11 h-11 shrink-0 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 text-white text-xl">
            <HiPaperAirplane className="-rotate-45" />
          </span>
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-slate-800">{t("telegram.title")}</p>
              {!loading &&
                (linked ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[11px] font-semibold">
                    <HiCheckCircle />
                    {t("telegram.linked")}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[11px] font-semibold">
                    {t("telegram.notLinked")}
                  </span>
                ))}
            </div>
            <p className="text-sm text-slate-500">{t(descriptionKey)}</p>
          </div>
        </div>

        {!loading && (
          <div className="flex items-center gap-2 shrink-0">
            {linked ? (
              <Button
                color="red"
                variant="outlined"
                className="gap-1.5 w-full sm:w-auto justify-center"
                aria-label={t("telegram.unlink")}
                onClick={onUnlinkRequest}
              >
                <HiLinkSlash className="text-base" />
                {t("telegram.unlink")}
              </Button>
            ) : (
              <Button
                color="blue"
                loading={connecting}
                className="gap-1.5 w-full sm:w-auto justify-center"
                aria-label={t("telegram.connect")}
                onClick={onConnect}
              >
                {connecting ? <HiClock className="text-base" /> : <HiLink className="text-base" />}
                {connecting ? t("telegram.waiting") : t("telegram.connect")}
                {!connecting && <HiArrowTopRightOnSquare className="text-sm opacity-70" />}
              </Button>
            )}
          </div>
        )}
      </div>

      {!loading && linked && (
        <div className="flex flex-col gap-2 pt-4 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-sm font-medium text-slate-700">{t("telegram.langLabel")}</span>
              <span className="text-xs text-slate-400">{t("telegram.langDesc")}</span>
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
  );
}

export default IntegrationCard;
