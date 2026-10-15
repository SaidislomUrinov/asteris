import { useTranslation } from "react-i18next";
import { HiArrowRight, HiBuildingOffice2, HiPaperAirplane, HiPhone } from "react-icons/hi2";
import UpdateLang from "../../components/UpdateLang";
import { brandHost, formatSupportPhone, platformUrl, supportPhones, supportTelegram } from "../../utils/brand";

/**
 * Mavjud bo'lmagan brend manzili (`xyz.wenet.uz`) — xabar va bog'lanish
 * (docs/API_CONTRACT_multi_center.md §5). Kontaktlar .env'dan
 * (VITE_SUPPORT_TELEGRAM, VITE_SUPPORT_PHONES).
 *
 * @param {{ slug: string }} props
 */
function BrandNotFound({ slug }) {
  const { t } = useTranslation();
  const telegram = supportTelegram();
  const phones = supportPhones();

  return (
    <div className="flex flex-col items-center justify-center gap-5 w-full min-h-dvh p-4">
      <p className="text-[40px] font-space font-semibold animate-rise-in [animation-delay:0ms]">
        <span className="font-space text-blue-500">WE</span>NET
      </p>

      {/* overflow-hidden YO'Q — pastdagi til menyusi karta tashqarisiga ochiladi. */}
      <div className="flex flex-col w-full sm:w-110 bg-white dark:bg-night-900 border border-slate-200 dark:border-night-700 rounded-xl">
        <div className="flex flex-col items-center gap-3 px-5 pt-7 pb-5 text-center animate-rise-in [animation-delay:0ms]">
          <span className="grid place-items-center size-14 rounded-2xl bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 text-2xl">
            <HiBuildingOffice2 />
          </span>
          <p className="font-semibold font-space text-[22px] leading-tight">{t("brand.notExistTitle")}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            {t("brand.notExistDesc", { host: brandHost(slug) })}
          </p>
        </div>

        <div className="flex flex-col gap-2 px-5 pb-5 animate-rise-in [animation-delay:80ms]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {t("brand.contactTitle")}
          </p>
          <a
            href={`https://t.me/${telegram}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-night-700 hover:bg-slate-50 dark:hover:bg-night-800 transition-colors"
          >
            <span className="grid place-items-center size-9 shrink-0 rounded-lg bg-[#229ED9]/12 text-[#229ED9] text-lg">
              <HiPaperAirplane className="-rotate-45" />
            </span>
            <span className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Telegram</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 truncate">@{telegram}</span>
            </span>
          </a>
          {phones.map((phone) => (
            <a
              key={phone}
              href={`tel:${phone}`}
              className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-night-700 hover:bg-slate-50 dark:hover:bg-night-800 transition-colors"
            >
              <span className="grid place-items-center size-9 shrink-0 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-lg">
                <HiPhone />
              </span>
              <span className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
                  {formatSupportPhone(phone)}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{t("brand.call")}</span>
              </span>
            </a>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-slate-100 dark:border-night-700 animate-rise-in [animation-delay:160ms]">
          <a
            href={platformUrl()}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            {t("brand.enterAddress")}
            <HiArrowRight className="text-base" />
          </a>
          <UpdateLang />
        </div>
      </div>
    </div>
  );
}

export default BrandNotFound;
