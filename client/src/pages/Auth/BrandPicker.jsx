import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiGlobeAlt } from "react-icons/hi2";
import { api } from "../../utils/fetching";
import { brandHost, brandUrl, normalizeSlugInput, SLUG_RE } from "../../utils/brand";
import { errorMsg } from "../../utils/alert";
import UpdateLang from "../../components/UpdateLang";
import Input from "../../ui/Input";
import Button from "../../ui/Button";

// Umumiy manzilda oxirgi kiritilgan markaz — keyingi safar avtomatik to'ladi.
const LAST_SLUG_KEY = "wenet:lastBrandSlug";
const readLastSlug = () => {
  try {
    return localStorage.getItem(LAST_SLUG_KEY) || "";
  } catch {
    return "";
  }
};

/**
 * Umumiy manzil (app.wenet.uz) — markaz manzilini kiritib, o'sha brend
 * subdomeniga o'tish (docs/API_CONTRACT_multi_center.md §5). Hodim logini
 * faqat markaz ichida yagona, shuning uchun login markaz manzilida qilinadi.
 *
 * @param {{ notFoundSlug?: string }} props - brend subdomeni topilmagan bo'lsa
 */
function BrandPicker({ notFoundSlug = "" }) {
  const { t } = useTranslation();
  const [value, setValue] = useState(() => notFoundSlug || readLastSlug());
  const [error, setError] = useState(notFoundSlug ? "brand.notFound" : "");
  const [loading, setLoading] = useState(false);
  const busyRef = useRef(false);

  const slug = normalizeSlugInput(value);

  const submit = async () => {
    if (busyRef.current) return;
    if (!SLUG_RE.test(slug)) {
      setError("brand.invalid");
      return;
    }
    try {
      busyRef.current = true;
      setLoading(true);
      const res = await api.get(`/client-auth/brand/${slug}`);
      const { ok, data, msg } = res.data;
      if (!ok) {
        setError(msg || "brand.notFound");
        return;
      }
      try {
        localStorage.setItem(LAST_SLUG_KEY, data.redirect || data.slug);
      } catch {
        // eslab qolish ixtiyoriy
      }
      window.location.assign(`${brandUrl(data.redirect || data.slug)}/`);
    } catch (e) {
      errorMsg(e.message);
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  };

  return (
    <div onKeyDown={(k) => k.key === "Enter" && submit()} className="flex flex-col items-center justify-center gap-5 w-full min-h-screen p-4">
      <p className="text-[40px] font-space font-semibold animate-rise-in [animation-delay:0ms]">
        <span className="font-space text-blue-500">WE</span>NET
      </p>
      <div className="flex flex-col w-full sm:w-110 bg-white dark:bg-night-900 border border-slate-200 dark:border-night-700 rounded-xl overflow-hidden">
        <div className="flex flex-col gap-1 p-5 border-b border-slate-100 dark:border-night-700 animate-rise-in [animation-delay:0ms]">
          <div className="flex items-center justify-between w-full gap-3">
            <p className="font-semibold font-space text-[22px]">{t("brand.title")}</p>
            <UpdateLang />
          </div>
          <p className="text-zinc-500 dark:text-slate-400 text-sm">{t("brand.desc")}</p>
        </div>

        <div className="flex flex-col gap-2 p-5 animate-rise-in [animation-delay:80ms]">
          <Input
            label={t("brand.address")}
            placeholder="markaz"
            required
            icon={<HiGlobeAlt />}
            value={value}
            error={!!error}
            hint={error ? t(error, { slug: notFoundSlug || slug }) : slug ? brandHost(slug) : t("brand.addressHint")}
            onChange={(e) => {
              setValue(e.target.value);
              setError("");
            }}
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        <div className="p-5 border-t border-slate-100 dark:border-night-700 animate-rise-in [animation-delay:160ms]">
          <Button fullWith loading={loading} onClick={submit}>
            {t("brand.continue")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default BrandPicker;
