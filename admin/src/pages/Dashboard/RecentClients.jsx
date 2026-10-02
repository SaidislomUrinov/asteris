import { useTranslation } from "react-i18next";
import Chip from "../../ui/Chip";

const STATUS_COLOR = {
  active: "emerald",
  expiringSoon: "yellow",
  expired: "red",
  none: "slate",
  cancelled: "slate",
  changed: "blue",
};

function formatDate(unix) {
  if (!unix) return "—";
  return new Date(unix * 1000).toLocaleDateString("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function RecentClients({ clients = [] }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3 p-5 rounded-xl border border-slate-200 bg-white h-full">
      <p className="font-semibold text-slate-800">{t("dashboard.recentClientsTitle")}</p>

      {clients.length === 0 ? (
        <div className="flex-1 min-h-32 flex items-center justify-center text-[13px] text-slate-400">
          {t("dashboard.recentClientsEmpty")}
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-slate-100 -mx-1">
          {clients.map((c) => (
            <div key={c._id} className="flex items-center justify-between gap-3 px-1 py-2.5">
              <div className="flex flex-col min-w-0">
                <span className="text-[13px] font-medium text-slate-800 truncate">{c.name}</span>
                <span className="text-[11px] text-slate-400 truncate">
                  {c.phone} · {formatDate(c.createdAt)}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-slate-500 hidden sm:inline">
                  {c.tariff || t("dashboard.noTariff")}
                </span>
                <Chip
                  value={t(`dashboard.status${capitalize(c.subscriptionStatus)}`)}
                  color={STATUS_COLOR[c.subscriptionStatus] || "slate"}
                  variant="ghost"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function capitalize(s = "") {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default RecentClients;
