import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiBuildingOffice2 } from "react-icons/hi2";
import { api } from "../../utils/fetching";
import { brandUrl, getBrandSlug } from "../../utils/brand";
import Loading from "../../ui/Loading";
import Button from "../../ui/Button";
import LoginForm from "./LoginForm";
import BrandPicker from "./BrandPicker";
import BrandNotFound from "./BrandNotFound";

/**
 * Kirish nuqtasi (docs/API_CONTRACT_multi_center.md §5):
 *  - umumiy manzil (app.wenet.uz) — markaz manzilini so'raydi (`BrandPicker`);
 *  - brend subdomeni — brendni yuklab, shu mijozning login formasi;
 *  - eski slug — yangi manzilga yo'naltiradi.
 */
function Auth() {
  const { t } = useTranslation();
  const slug = getBrandSlug();
  const [state, setState] = useState(slug ? "loading" : "picker");
  const [brand, setBrand] = useState(null);

  useEffect(() => {
    if (!slug) return undefined;
    let alive = true;
    (async () => {
      try {
        const res = await api.get(`/client-auth/brand/${slug}`);
        const { ok, data } = res.data;
        if (!alive) return;
        if (!ok) return setState("notFound");
        if (data.redirect) {
          window.location.replace(`${brandUrl(data.redirect)}${window.location.pathname}`);
          return;
        }
        setBrand(data);
        setState("ready");
      } catch {
        if (alive) setState("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  if (state === "picker") return <BrandPicker />;
  if (state === "notFound") return <BrandNotFound slug={slug} />;
  if (state === "ready") return <LoginForm brand={brand} />;

  return (
    <div className="flex flex-col items-center justify-center gap-4 w-full h-screen p-4 text-center">
      {state === "loading" ? (
        <Loading />
      ) : (
        <>
          <span className="grid place-items-center size-14 rounded-2xl bg-slate-100 dark:bg-night-800 text-2xl text-slate-400">
            <HiBuildingOffice2 />
          </span>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("brand.loadError")}</p>
          <Button variant="outlined" color="black" onClick={() => window.location.reload()}>
            {t("common.retry")}
          </Button>
        </>
      )}
    </div>
  );
}

export default Auth;
