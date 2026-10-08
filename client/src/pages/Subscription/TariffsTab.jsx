import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import {
  HiBuildingOffice2,
  HiCheckCircle,
  HiChevronDown,
  HiCreditCard,
  HiClock,
  HiAcademicCap,
  HiExclamationTriangle,
  HiUserGroup,
  HiUsers,
} from "react-icons/hi2";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import { updateUser } from "../../contexts/user";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { TARIFF_FEATURE_KEYS, featureLabelKey } from "./permissionLabels";
import { FORCE_DISABLED } from "../../hooks/useFeature";
import Loading from "../../ui/Loading";
import Button from "../../ui/Button";
import Chip from "../../ui/Chip";
import SubscribeModal from "./SubscribeModal";
import SubscriptionActivatedModal from "./SubscriptionActivatedModal";

const PENDING_ORDER_KEY = "pendingSubscriptionOrderId";
const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 20; // ~60s — shundan keyin ham hali "pending" bo'lsa fon ishi (15 daqiqa) yakunlaydi

// 2 qatorli grid tartibi: 1-qator Filial/O'qituvchi, 2-qator Resepshin/O'quvchi
const LIMIT_FIELDS = [
  { key: "centerLimit", labelKey: "subscription.centers", icon: HiBuildingOffice2 },
  { key: "teacherLimit", labelKey: "subscription.teachers", icon: HiAcademicCap },
  { key: "receptionLimit", labelKey: "subscription.receptions", icon: HiUserGroup },
  { key: "studentLimit", labelKey: "subscription.students", icon: HiUsers },
];

// Uch (yoki undan ko'p) tarif orasida narx bo'yicha eng arzoni/o'rtachasi/eng
// qimmatiga mos accent — index emerald->blue->violet aylanadi, ular
// orasidagilar hammasi "Eng ommabop" blue tema oladi.
const ACCENTS = [
  {
    border: "border-emerald-300",
    ring: "hover:border-emerald-400",
    color: "emerald",
    sloganKey: "subscription.sloganQuickStart",
    box: "bg-emerald-50 dark:bg-emerald-500/15",
    boxIcon: "text-emerald-500",
    boxValue: "text-emerald-900 dark:text-emerald-400",
  },
  {
    border: "border-blue-400",
    ring: "hover:border-blue-500",
    color: "blue",
    sloganKey: "subscription.sloganPopular",
    box: "bg-blue-50 dark:bg-blue-500/15",
    boxIcon: "text-blue-500",
    boxValue: "text-blue-900 dark:text-blue-400",
  },
  {
    border: "border-violet-300",
    ring: "hover:border-violet-400",
    color: "violet",
    sloganKey: "subscription.sloganFull",
    box: "bg-violet-50 dark:bg-violet-500/15",
    boxIcon: "text-violet-500",
    boxValue: "text-violet-900 dark:text-violet-400",
  },
];

const formatLimit = (t, value) =>
  value === -1 ? t("subscription.unlimited") : value;

const getAccent = (index, total) => {
  if (total <= 1) return ACCENTS[1];
  if (index === 0) return ACCENTS[0];
  if (index === total - 1) return ACCENTS[2];
  return ACCENTS[1];
};

function TariffsTab() {
  const { t } = useTranslation();
  const dp = useDispatch();
  const { subscription, trialUsed } = useSelector((e) => e.user);
  const [rows, setRows] = useState([]);
  const [activeCenterCount, setActiveCenterCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());
  const [subscribingId, setSubscribingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTariff, setModalTariff] = useState(null);
  const [activatedModal, setActivatedModal] = useState(null); // { tariffName } | null

  const toggleExpanded = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const currentTariffId = subscription?.tariff?._id || subscription?.tariff;
  const isSubscriptionActive = subscription?.status === "active";
  // "Muddati tugashiga 2 kun qolganda ogohlantirish" (CLAUDE.md "Subscription
  // hayotiy sikli") — shu banner orqali Tariflar bo'limida ham ko'rinadi.
  const daysLeft = isSubscriptionActive
    ? Math.max(0, Math.ceil((subscription.endDate - new Date().getTime() / 1000) / 86400))
    : null;
  const expiringSoon = daysLeft !== null && daysLeft <= 2;
  // Trial ishlatilganligi endi backendda alohida `trialUsed` flag orqali
  // kuzatiladi (Client hujjatida) va login/verify javobi bilan Redux'ga
  // keladi — shu sabab bu yerda haqiqiy qiymatdan foydalanamiz.
  const hasUsedTrial = !!trialUsed;

  const fetchTariffs = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await api.get("/client-auth/tariffs");
      const { ok, data, activeCenterCount, msg } = res.data;
      if (!ok) throw new Error(msg);
      setRows([...(data || [])].sort((a, b) => a.price - b.price));
      setActiveCenterCount(activeCenterCount || 0);
    } catch (error) {
      setError(true);
      errorMsg(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(fetchTariffs, 0);
    return () => clearTimeout(t);
  }, [fetchTariffs]);

  // inPAY `return_url`dan qaytilgach (yoki hatto webhook tezroq kelib
  // ulgurmagan bo'lsa) — shu tabda boshlangan to'lovni kutamiz. Webhook
  // kelmay qolsa ham (masalan tarmoq sekinligi) foydalanuvchi bu orqali
  // baribir natijani ko'radi.
  useEffect(() => {
    const orderId = localStorage.getItem(PENDING_ORDER_KEY);
    if (!orderId) return;

    let attempts = 0;
    let cancelled = false;

    const clearPending = () => localStorage.removeItem(PENDING_ORDER_KEY);

    const poll = async () => {
      if (cancelled) return;
      attempts += 1;
      try {
        const res = await api.get(`/client-auth/subscription/status/${orderId}`);
        const { ok, status, data } = res.data;
        if (!ok) return;

        if (status === "paid") {
          clearPending();
          dp(updateUser({ ...data }));
          fetchTariffs();
          setActivatedModal({ tariffName: data?.subscription?.tariffSnapshot?.name || "" });
          return;
        }
        if (status === "cancelled" || status === "failed") {
          clearPending();
          errorMsg("subscription.paymentFailed");
          return;
        }
      } catch {
        // navbatdagi tikda qayta urinib ko'riladi
      }

      if (attempts < POLL_MAX_ATTEMPTS) {
        setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Boshqa hodim (yoki Boshliqning boshqa tabi) to'lov qilgan bo'lsa ham
  // — `client:{clientId}` xonasidagi HAMMA shu holatni realtime oladi.
  useSocketEvent("subscription:activated", ({ data, tariffName, orderId }) => {
    dp(updateUser({ ...data }));
    fetchTariffs();

    const pending = localStorage.getItem(PENDING_ORDER_KEY);
    if (pending && pending === orderId) {
      localStorage.removeItem(PENDING_ORDER_KEY);
      setActivatedModal({ tariffName });
    } else {
      successMsg("subscription.activatedByOther");
    }
  });

  // Faqat trial holatida (showTrialOffer === true) darhol chaqiriladi — bu
  // mantiq o'zgarmagan, modal orqali o'tmaydi.
  const activateTrial = async (tariff) => {
    try {
      setSubscribingId(tariff._id);
      const res = await api.post("/client-auth/subscription/initiate", {
        tariffId: tariff._id,
      });
      const { ok, activated, payUrl, orderId, msg, data } = res.data;
      if (!ok) throw new Error(msg);

      if (activated) {
        successMsg("subscription.trialActivated");
        dp(updateUser({ ...data }));
        fetchTariffs();
      } else if (payUrl) {
        if (orderId) localStorage.setItem("pendingSubscriptionOrderId", orderId);
        window.location.assign(payUrl);
      }
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setSubscribingId(null);
    }
  };

  const openSubscribeModal = (tariff) => {
    setModalTariff(tariff);
    setModalOpen(true);
  };

  const closeSubscribeModal = () => {
    setModalOpen(false);
    setModalTariff(null);
  };

  const handleModalActivated = (data) => {
    dp(updateUser({ ...data }));
    successMsg("subscription.extended");
    fetchTariffs();
    closeSubscribeModal();
  };

  if (loading) return <Loading height="30vh" />;

  if (error)
    return (
      <div className="flex flex-col items-center justify-center w-full flex-1 gap-3 text-slate-400 dark:text-slate-500 py-10">
        <HiCreditCard className="text-4xl" />
        <p className="text-sm">{t("subscription.loadError")}</p>
        <Button variant="outlined" onClick={fetchTariffs}>
          {t("common.retry")}
        </Button>
      </div>
    );

  if (!rows.length)
    return (
      <div className="flex flex-col items-center justify-center w-full flex-1 gap-3 text-slate-400 dark:text-slate-500 py-10">
        <HiCreditCard className="text-4xl" />
        <p className="text-sm">{t("subscription.tariffsEmpty")}</p>
      </div>
    );

  return (
    <>
    {daysLeft !== null && (
      <div
        className={`flex items-center gap-3 p-4 rounded-xl border ${
          expiringSoon
            ? "border-orange-200 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/15 text-orange-700 dark:text-orange-400"
            : "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
        }`}
      >
        {expiringSoon ? (
          <HiExclamationTriangle className="text-xl shrink-0" />
        ) : (
          <HiClock className="text-xl shrink-0" />
        )}
        <div className="flex flex-col">
          <span className="font-semibold">
            {t("subscription.daysLeft", { count: daysLeft })}
          </span>
          <span className="text-sm opacity-80">
            {t("subscription.endDate")}: {subscription.endDateText}
          </span>
        </div>
        {expiringSoon && (
          <span className="ml-auto text-sm font-semibold shrink-0">
            {t("subscription.expiringSoon")}
          </span>
        )}
      </div>
    )}

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
      {rows.map((tariff, index) => {
        const isCurrent = isSubscriptionActive && currentTariffId === tariff._id;
        const accent = getAccent(index, rows.length);
        const showTrialOffer =
          !isCurrent && tariff.trialDays > 0 && !hasUsedTrial;
        // Hozirgi faol filiallar soni tarifning centerLimit'idan ko'p bo'lsa
        // — bu tarifga ulanib bo'lmaydi (overflow-modal endi faqat admin
        // tomonidan changeTariff bilan tayinlangan holatlar uchun zaxira).
        const insufficientCenters =
          !isCurrent && tariff.centerLimit !== -1 && tariff.centerLimit < activeCenterCount;

        return (
          <div
            key={tariff._id}
            className={`flex flex-col gap-4 p-5 rounded-xl border-2 bg-white dark:bg-night-900 duration-200 ${
              insufficientCenters
                ? "opacity-60 grayscale-[30%]"
                : "hover:-translate-y-1 hover:shadow-xl dark:hover:shadow-none"
            } ${isCurrent ? "border-emerald-500" : `${accent.border} ${accent.ring}`}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-1">
                <p className="font-space font-bold text-2xl text-slate-800 dark:text-slate-100">
                  {tariff.name}
                </p>
                <Chip
                  value={t(accent.sloganKey)}
                  color={accent.color}
                  variant="ghost"
                  className="w-fit"
                />
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                {isCurrent && (
                  <Chip value={t("subscription.currentPlan")} color="emerald" variant="filled" />
                )}
              </div>
            </div>

            {insufficientCenters && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 text-xs">
                <HiExclamationTriangle className="text-sm shrink-0 mt-0.5" />
                <span>
                  {t("subscription.insufficientCenterLimit", {
                    count: activeCenterCount,
                    limit: tariff.centerLimit,
                  })}
                </span>
              </div>
            )}

            <p className="text-base font-semibold text-slate-500 dark:text-slate-400">
              {tariff.price.toLocaleString("uz-UZ")}{" "}
              <span className="font-normal text-slate-400 dark:text-slate-500">
                {t("subscription.perMonth")}
              </span>
            </p>

            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 dark:border-night-700">
              {LIMIT_FIELDS.map((f) => {
                const Icon = f.icon;
                return (
                  <div
                    key={f.key}
                    className={`flex flex-col gap-1 p-2.5 rounded-lg ${accent.box}`}
                  >
                    <span className={`flex items-center gap-1 text-[11px] ${accent.boxIcon}`}>
                      <Icon className="text-sm shrink-0" />
                      {t(f.labelKey)}
                    </span>
                    <span className={`font-semibold ${accent.boxValue}`}>
                      {formatLimit(t, tariff[f.key])}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="pt-1">
              {isCurrent ? (
                <Button
                  fullWith
                  variant="outlined"
                  color="emerald"
                  onClick={() => openSubscribeModal(tariff)}
                >
                  <HiCheckCircle className="text-base" />
                  {t("subscription.extend")}
                </Button>
              ) : (
                <Button
                  fullWith
                  color={accent.color}
                  disabled={insufficientCenters}
                  onClick={() =>
                    showTrialOffer ? activateTrial(tariff) : openSubscribeModal(tariff)
                  }
                  loading={subscribingId === tariff._id}
                >
                  {showTrialOffer ? (
                    <span className="flex items-center gap-1.5">
                      <HiClock className="text-base" />
                      {t("subscription.trialDays", { count: tariff.trialDays })}
                    </span>
                  ) : (
                    t("subscription.subscribe")
                  )}
                </Button>
              )}
            </div>

            {tariff.allowedPermissions?.length > 0 && (
              <div className="flex flex-col gap-2 pt-3 border-t border-slate-100 dark:border-night-700">
                <button
                  type="button"
                  onClick={() => toggleExpanded(tariff._id)}
                  className="flex items-center justify-between w-full cursor-pointer text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 duration-150"
                >
                  {t("subscription.featuresTitle")}
                  <HiChevronDown
                    className={`text-sm duration-200 ${
                      expanded.has(tariff._id) ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {expanded.has(tariff._id) && (
                  <div className="flex flex-col gap-1.5">
                    {/* Vaqtincha production'da o'chirilgan funksiyalar (QR
                        davomat, AI) eski tarif hujjatida qolib ketgan bo'lsa
                        ham mijozga reklama qilinmaydi (useFeature.js). */}
                    {tariff.allowedPermissions
                      .filter(
                        (p) =>
                          TARIFF_FEATURE_KEYS.includes(p) && !p.startsWith("ai.") && !FORCE_DISABLED.includes(p),
                      )
                      .map((p) => (
                      <div key={p} className="flex items-center gap-2 text-sm">
                        <HiCheckCircle className="text-emerald-500 text-base shrink-0" />
                        <span className="text-slate-700 dark:text-slate-300">
                          {t(featureLabelKey(p))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>

    <SubscribeModal
      open={modalOpen}
      onClose={closeSubscribeModal}
      tariff={modalTariff}
      onActivated={handleModalActivated}
    />

    <SubscriptionActivatedModal
      open={!!activatedModal}
      onClose={() => setActivatedModal(null)}
      tariffName={activatedModal?.tariffName}
    />
    </>
  );
}

export default TariffsTab;
