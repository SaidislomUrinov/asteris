import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiAdjustmentsHorizontal, HiXMark } from "react-icons/hi2";
import Button from "./Button";
import Dialog from "./Dialog";
import useMediaQuery from "../hooks/useMediaQuery";

// Tailwind `sm` breakpoint. Mobil (< 640px) da filtrlar sahifada emas,
// "Filterlash" tugmasi orqali ochiladigan Modal ichida ko'rsatiladi.
const DESKTOP = "(min-width: 640px)";

const COLS = {
  1: "",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

/**
 * Ro'yxat sahifalari uchun yagona filtr paneli.
 *
 * Katta ekranda: qidiruv + amal tugmalari birinchi qatorda, filtrlar ostidagi
 * gridda. Mobil ekranda: filtrlar yashiriladi, o'rniga "Filterlash" tugmasi
 * chiqadi va u Modal ichida aynan o'sha filtrlarni ochadi — logikasi bir xil,
 * faqat joylashuvi boshqacha.
 *
 * Filtrlar DOM'da FAQAT BIR MARTA render bo'ladi (`useMediaQuery` orqali),
 * shuning uchun controlled input'lar dublikat bo'lib qolmaydi.
 *
 * @param {Object} props
 * @param {React.ReactNode} [props.search] — har doim ko'rinadigan qidiruv maydoni
 * @param {React.ReactNode} props.children — filtr maydonlari (mobilda modalda)
 * @param {React.ReactNode} [props.actions] — har doim ko'rinadigan tugmalar ("Yaratish"...)
 * @param {React.ReactNode} [props.extras] — har doim ko'rinadigan qo'shimcha blok (jami summa...)
 * @param {number} [props.activeCount=0] — tanlangan filtrlar soni (tugmadagi belgi)
 * @param {() => void} [props.onReset] — berilsa modal ichida "Tozalash" tugmasi chiqadi
 * @param {1|2|3|4} [props.cols=3] — desktop filtr gridi ustunlari soni
 * @param {boolean} [props.dim=false] — filtrlarni xiralashtirib o'chirib qo'yish
 * @param {string} [props.title] — modal sarlavhasi
 */
function FilterBar({
  search,
  children,
  actions,
  extras,
  activeCount = 0,
  onReset,
  cols = 3,
  dim = false,
  title,
  className = "",
}) {
  const { t } = useTranslation();
  const isDesktop = useMediaQuery(DESKTOP);
  const [open, setOpen] = useState(false);

  const hasFilters = Boolean(children);

  const filterGrid = (
    <div
      className={`grid grid-cols-1 ${COLS[cols] || COLS[3]} gap-3 w-full duration-150 ${
        dim ? "opacity-50 pointer-events-none" : ""
      }`}
    >
      {children}
      {/* Katta ekranda "Tozalash" filtrlar gridining oxirgi katagi — HAR DOIM
          turadi (filtr yo'q bo'lsa o'chirilgan), shunda filtr tanlanganda
          yangi element "paydo bo'lib" layout sakramaydi. */}
      {isDesktop && onReset && (
        <Button
          variant="outlined"
          color="red"
          disabled={activeCount === 0}
          onClick={onReset}
          className="gap-1.5"
        >
          <HiXMark className="text-base" />
          {t("common.resetFilters")}
        </Button>
      )}
    </div>
  );

  return (
    <div
      className={`flex flex-col gap-3 p-4 rounded-xl border border-slate-200 bg-white ${className}`}
    >
      <div className="flex flex-col sm:flex-row gap-3 w-full">
        {(search || (hasFilters && !isDesktop)) && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {search && <div className="flex-1 min-w-0">{search}</div>}
            {hasFilters && !isDesktop && (
              <Button
                variant="outlined"
                color="slate"
                className={`gap-1.5 shrink-0 !px-4 ${search ? "" : "w-full"}`}
                onClick={() => setOpen(true)}
              >
                <HiAdjustmentsHorizontal className="text-base" />
                {t("common.filter")}
                {activeCount > 0 && (
                  <span className="flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-blue-500 text-white text-[11px]">
                    {activeCount}
                  </span>
                )}
              </Button>
            )}
          </div>
        )}

        {actions && (
          <div className="flex flex-col sm:flex-row gap-2 [&>*]:w-full sm:[&>*]:w-auto">
            {actions}
          </div>
        )}
      </div>

      {hasFilters && isDesktop && filterGrid}

      {extras}

      {hasFilters && !isDesktop && (
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title={title || t("common.filter")}
          actions={
            <>
              {onReset && (
                <Button
                  variant="text"
                  color="red"
                  disabled={activeCount === 0}
                  onClick={() => {
                    onReset();
                    setOpen(false);
                  }}
                >
                  {t("common.resetFilters")}
                </Button>
              )}
              <Button onClick={() => setOpen(false)}>{t("common.apply")}</Button>
            </>
          }
        >
          {filterGrid}
        </Dialog>
      )}
    </div>
  );
}

export default FilterBar;
