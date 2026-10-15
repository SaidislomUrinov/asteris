import { useTranslation } from "react-i18next";
import { HiHeart, HiOutlineHeart, HiPhoto } from "react-icons/hi2";
import { CoinIcon } from "../../components/CoinIcon";
import { photoSrc } from "../../lib/studentPhoto";
import { cn } from "../../utils/cn";

// Do'kon mahsuloti kartasi. Tanga yetmasa — "Yana N tanga" + progress (motivatsiya).
// p: { _id, name, price, photo, stock, likes, liked }
export const ProductCard = ({ p, balance, canBuy, onBuy, onLike }) => {
  const { t } = useTranslation();
  const soldOut = p.stock === 0;
  const missing = Math.max(0, p.price - balance);
  const progress = Math.min(100, Math.round((balance / p.price) * 100));
  const affordable = !soldOut && missing === 0;
  return (
    <div
      className={cn(
        "flex flex-col bg-card rounded-2xl border overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        affordable ? "border-amber-400/60 ring-1 ring-amber-400/30" : "border-line/70",
      )}
    >
      <div className="relative aspect-square bg-amber-400/10 grid place-items-center">
        {p.photo ? (
          <img
            src={photoSrc(p.photo)}
            alt={p.name}
            loading="lazy"
            className={cn("absolute inset-0 w-full h-full object-cover", soldOut && "grayscale opacity-70")}
          />
        ) : (
          <HiPhoto className="w-10 h-10 text-amber-500/40" />
        )}
        {canBuy ? (
          <button
            type="button"
            onClick={() => onLike(p)}
            aria-pressed={p.liked}
            className="absolute top-2 right-2 h-8 min-w-8 px-2 rounded-full bg-black/35 backdrop-blur-sm text-white flex items-center justify-center gap-1 text-[12px] font-bold active:scale-90 transition-transform"
          >
            {p.liked ? <HiHeart className="w-4 h-4 text-rose-400" /> : <HiOutlineHeart className="w-4 h-4" />}
            {p.likes > 0 && <span className="tabular-nums">{p.likes}</span>}
          </button>
        ) : (
          p.likes > 0 && (
            <span className="absolute top-2 right-2 h-7 px-2 rounded-full bg-black/35 text-white flex items-center gap-1 text-[12px] font-bold">
              <HiHeart className="w-3.5 h-3.5 text-rose-400" />
              <span className="tabular-nums">{p.likes}</span>
            </span>
          )
        )}
        {/* Narx — rasm ustida oltin yorliq */}
        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 pl-1.5 pr-2.5 h-7 rounded-full bg-white/95 text-amber-700 text-[14px] font-extrabold tabular-nums shadow-[0_2px_8px_-2px_rgba(0,0,0,0.35)]">
          <CoinIcon size={18} />
          {p.price}
        </span>
        {soldOut ? (
          <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 py-1.5 text-center text-[12px] font-bold text-white bg-black/55">{t("coins.soldOut")}</span>
        ) : (
          p.stock !== null &&
          p.stock <= 5 && (
            <span className="absolute bottom-2 left-2 px-2 h-7 inline-flex items-center rounded-full bg-black/50 text-white text-[11px] font-bold">
              {t("coins.left", { n: p.stock })}
            </span>
          )
        )}
      </div>
      <div className="flex flex-col gap-2.5 p-2.5 flex-1">
        <div className="text-[13px] font-bold leading-snug line-clamp-2 break-words min-h-[2.5em]">{p.name}</div>
        <div className="mt-auto">
          {soldOut ? null : missing > 0 ? (
            <div className="flex flex-col gap-1.5">
              <div className="h-2 rounded-full bg-ink/8 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-300 to-orange-500 min-w-2"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between gap-1.5 text-[11px] font-bold">
                <span className="text-hint min-w-0 break-words">{t("coins.needMore", { n: missing })}</span>
                <span className="tabular-nums text-amber-600 dark:text-amber-400 shrink-0">{progress}%</span>
              </div>
            </div>
          ) : canBuy ? (
            <button
              type="button"
              onClick={() => onBuy(p)}
              className="w-full h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white text-[13px] font-extrabold shadow-[0_4px_12px_-4px_rgba(217,119,6,0.7)] active:scale-[0.97] transition-transform"
            >
              {t("coins.buy")}
            </button>
          ) : (
            <div className="text-[11px] font-bold text-ok">{t("coins.enough")}</div>
          )}
        </div>
      </div>
    </div>
  );
};
