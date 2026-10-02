import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  HiBuildingOffice2,
  HiCheckCircle,
  HiExclamationTriangle,
  HiUserGroup,
  HiUsers,
} from "react-icons/hi2";
import Button from "../../ui/Button";
import LazyImage from "../../ui/LazyImage";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { api, API } from "../../utils/fetching";
import i18n from "../../utils/i18n";
import { useBlockingModal } from "../../utils/blockingModal";

// Tarif pasayganda ortiqcha filiallardan qaysilari ishlashda davom etishini
// SO'RAYDIGAN modal. CLAUDE.md talabi: MAJBURIY va YOPILMAYDI —
// ESC, overlay bosish, X tugma — hech biri yo'q. Yagona chiqish yo'li:
// aynan kerakli sonda filial tanlab "Tasdiqlash".
//
// `ui/Dialog` ataylab ISHLATILMAYDI — u yopiladigan qilib qurilgan
// (X tugmasi va `onClose`). Buning o'rniga `SubscriptionBlockedModal.jsx`
// naqshi: to'g'ridan-to'g'ri `createPortal`.
function DowngradeDialog({ overflow, onResolved }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [keep, setKeep] = useState([]);
  const [loading, setLoading] = useState(false);
  // Kirish animatsiyasi: opacity 0→1 + translateY(12px)→0 (CLAUDE.md —
  // motion faqat modal/Auth uchun). Birinchi kadrdan keyin yoqiladi.
  const [shown, setShown] = useState(false);
  // Yangiliklar popup'i shu modal ochiq turganda kutadi (utils/blockingModal.js).
  useBlockingModal(!!overflow?.needsAction);

  const centers = overflow?.centers || [];
  const limit = overflow?.limit ?? 0;
  const activeCount = overflow?.activeCount ?? centers.length;
  const blockedCount = Math.max(0, activeCount - limit);
  const ready = keep.length === limit;

  // Modal ochiq turganda ostidagi sahifa aylanmasligi kerak.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const id = requestAnimationFrame(() => setShown(true));
    return () => {
      document.body.style.overflow = prev;
      cancelAnimationFrame(id);
    };
  }, []);

  if (!overflow?.needsAction) return null;

  const toggle = (id) =>
    setKeep((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      // Limitdan ortiq tanlashga yo'l qo'yilmaydi — foydalanuvchi avval
      // birini bekor qilishi kerak, shunda qaror ongli bo'ladi.
      if (prev.length >= limit) return prev;
      return [...prev, id];
    });

  const confirm = async () => {
    if (!ready || loading) return;
    setLoading(true);

    const request = (async () => {
      const res = await api.post("/centers/resolve-overflow", { keep });
      const { ok, msg } = res.data;
      if (!ok) throw new Error(i18n.t(msg));
      return msg;
    })();

    toast.promise(request, {
      loading: t("downgrade.saving"),
      success: (msg) => i18n.t(msg || "downgrade.saved"),
      error: (err) => err.message,
    });

    try {
      await request;
      onResolved?.();
      // Navigatsiya, ruxsatlar va `centerId` konteksti qaytadan
      // hisoblanishi uchun to'liq qayta yuklash eng ishonchli yo'l.
      window.location.reload();
    } catch {
      // xato toast'da ko'rsatildi — modal ochiq qoladi
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 w-full h-full bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className={`flex flex-col w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-xl transition-all duration-300 ease-out ${
          shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
        }`}
      >
        <div className="flex items-start gap-3 p-5 border-b border-slate-200">
          <span className="flex items-center justify-center w-11 h-11 shrink-0 rounded-xl bg-amber-50 text-amber-500 text-2xl">
            <HiExclamationTriangle />
          </span>
          <div className="flex flex-col gap-0.5 min-w-0">
            <h3 className="text-lg font-semibold text-slate-800">{t("downgrade.title")}</h3>
            <p className="text-sm text-slate-500">
              {t("downgrade.description", { limit, activeCount })}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 p-5 flex-1 min-h-0 overflow-y-auto">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-600">{t("downgrade.pickCenters")}</p>
            <span
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                ready ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
              }`}
            >
              {t("downgrade.selectedCount", { count: keep.length, limit })}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {centers.map((c) => {
              const on = keep.includes(c._id);
              const full = !on && keep.length >= limit;

              return (
                <button
                  key={c._id}
                  type="button"
                  onClick={() => toggle(c._id)}
                  className={`relative flex items-start gap-3 p-4 rounded-xl border text-left cursor-pointer duration-200 ${
                    on
                      ? "border-blue-500 ring-2 ring-blue-100 bg-blue-50/40"
                      : full
                        ? "border-slate-200 opacity-60 hover:opacity-100"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {c.logo ? (
                    <LazyImage
                      src={c.logo.startsWith("http") ? c.logo : `${API}${c.logo}`}
                      className="w-12 h-12 rounded-xl object-cover shrink-0 bg-slate-100"
                    />
                  ) : (
                    <span className="flex items-center justify-center w-12 h-12 shrink-0 rounded-xl bg-slate-100 text-slate-400 text-xl">
                      <HiBuildingOffice2 />
                    </span>
                  )}

                  <span className="flex flex-col gap-1 min-w-0 flex-1">
                    <span className="font-semibold text-slate-800 truncate">{c.name}</span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <HiUsers className="text-sm text-slate-400" />
                        {t("downgrade.students", { count: c.students ?? 0 })}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <HiUserGroup className="text-sm text-slate-400" />
                        {t("downgrade.groups", { count: c.groups ?? 0 })}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <HiUsers className="text-sm text-slate-400" />
                        {t("downgrade.staff", { count: c.staff ?? 0 })}
                      </span>
                    </span>
                  </span>

                  {on && (
                    <HiCheckCircle className="absolute top-3 right-3 text-xl text-blue-500" />
                  )}
                </button>
              );
            })}
          </div>

          {blockedCount > 0 && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200">
              <HiExclamationTriangle className="text-lg text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                {t("downgrade.warning", { count: blockedCount })}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 p-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          {/* Modal yopilmaydi — ostidagi sahifa almashadi. To'lov qilinsa
              `subscription:changed` keladi va modal o'zi yo'qoladi. */}
          <Button variant="text" color="blue" onClick={() => navigate("/subscription")}>
            {t("downgrade.upgrade")}
          </Button>

          <Button disabled={!ready} loading={loading} onClick={confirm}>
            {t("downgrade.confirm")}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Global joylashuv uchun o'ram (docs/API_CONTRACT.md §7.2): `App.jsx` da
 * `SubscriptionBlockedModal` yonida bir qator bo'lib turadi va holatni o'zi
 * aniqlaydi. Xohlansa tayyor `overflow` ham berilishi mumkin (Subscription
 * sahifasi to'lovdan keyin darrov ko'rsatmoqchi bo'lsa).
 *
 * @param {Object} props
 * @param {Object} [props.overflow] - tayyor `/centers/overflow` javobi
 */
function DowngradeModal({ overflow: provided }) {
  const { authType } = useSelector((e) => e.user);
  const [overflow, setOverflow] = useState(provided || null);

  const check = useCallback(async () => {
    // Faqat Client Owner: tarif qarori hodimning ishi emas, backend ham
    // bu endpointni `requireOwner` bilan yopgan.
    if (authType !== "owner") return;
    try {
      const res = await api.get("/centers/overflow");
      const { ok, data } = res.data;
      if (ok) setOverflow(data || null);
    } catch {
      // tekshiruv muvaffaqiyatsiz bo'lsa modal ko'rsatilmaydi —
      // foydalanuvchini bo'sh modal bilan qamab qo'ymaymiz
    }
  }, [authType]);

  useEffect(() => {
    const t = setTimeout(() => (provided ? setOverflow(provided) : check()), 0);
    return () => clearTimeout(t);
  }, [provided, check]);

  // Tarif o'zgarganda (ko'tarilsa ham, pasaysa ham) qayta tekshiriladi.
  // Server shu nomlar bilan emit qiladi: admin change-tariff/subscribe →
  // `subscription:updated`, inPAY to'lov → `subscription:activated`,
  // boshqa tabdagi tanlov/qayta ochish → `center:statusChanged`.
  useSocketEvent("subscription:updated", check, authType === "owner");
  useSocketEvent("subscription:activated", check, authType === "owner");
  useSocketEvent("center:statusChanged", check, authType === "owner");

  if (authType !== "owner" || !overflow?.needsAction) return null;

  return <DowngradeDialog overflow={overflow} onResolved={() => setOverflow(null)} />;
}

export default DowngradeModal;
