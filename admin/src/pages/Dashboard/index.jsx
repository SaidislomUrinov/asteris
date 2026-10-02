import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiArrowPath,
  HiBanknotes,
  HiBuildingOffice2,
  HiClock,
  HiExclamationTriangle,
  HiUserGroup,
  HiUsers,
  HiWallet,
  HiXCircle,
} from "react-icons/hi2";
import { api } from "../../utils/fetching";
import Button from "../../ui/Button";
import Loading from "../../ui/Loading";
import MoneyCard from "./MoneyCard";
import StatCard from "./StatCard";
import RevenueTrendChart from "./RevenueTrendChart";
import ClientGrowthChart from "./ClientGrowthChart";
import DistributionDonut from "./DistributionDonut";
import RecentClients from "./RecentClients";

const STATUS_COLORS = {
  active: "#10b981",
  expiringSoon: "#f59e0b",
  expired: "#ef4444",
  none: "#94a3b8",
};

function Dashboard() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await api.get("/admin/dashboard");
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setData(data);
      setError("");
    } catch {
      setError(t("dashboard.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    // setTimeout — effect tanasida to'g'ridan-to'g'ri setState chaqirilmasligi uchun
    const first = setTimeout(() => fetchData(), 0);
    return () => clearTimeout(first);
  }, [fetchData]);

  if (loading) return <Loading height="60vh" />;

  return (
    <div className="flex flex-col w-full gap-4 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-2 w-full shrink-0">
        <div className="flex flex-col gap-0.5">
          <p className="text-[18px] font-semibold text-slate-800">{t("dashboard.title")}</p>
          <p className="text-[12px] text-slate-400">{t("dashboard.subtitle")}</p>
        </div>
        <Button color="slate" variant="ghost" onClick={() => fetchData()}>
          <HiArrowPath className="text-base" />
          {t("common.refresh")}
        </Button>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-2 w-full bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-sm">
          <span className="flex items-center gap-2">
            <HiExclamationTriangle className="text-base shrink-0" />
            {error}
          </span>
          <Button color="red" variant="text" onClick={() => fetchData()}>
            {t("dashboard.retry")}
          </Button>
        </div>
      )}

      {data && (
        <>
          {/* Moliyaviy — eng muhim ko'rsatkichlar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <MoneyCard
              icon={<HiWallet />}
              label={t("dashboard.currentMonthRevenue")}
              value={Number(data.revenue.currentMonth).toLocaleString("uz-UZ")}
              suffix={t("dashboard.somSuffix")}
              hint={`${t("dashboard.lastMonthRevenue")}: ${Number(data.revenue.lastMonth).toLocaleString("uz-UZ")} ${t("dashboard.somSuffix")}`}
              gradient="from-blue-500 to-blue-700"
            />
            <MoneyCard
              icon={<HiBanknotes />}
              label={t("dashboard.mrr")}
              value={Number(data.revenue.mrr).toLocaleString("uz-UZ")}
              suffix={t("dashboard.somSuffix")}
              gradient="from-emerald-500 to-emerald-700"
            />
            <MoneyCard
              icon={<HiExclamationTriangle />}
              label={t("dashboard.expiringSoon")}
              value={data.totals.expiringSoon}
              hint={`${t("dashboard.expiredSubscriptions")}: ${data.totals.expired}`}
              gradient="from-amber-500 to-amber-700"
            />
          </div>

          {/* Ikkilamchi hisoblagichlar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard
              icon={<HiUsers />}
              label={t("dashboard.totalClients")}
              value={data.totals.clients}
              color="blue"
            />
            <StatCard
              icon={<HiUsers />}
              label={t("dashboard.activeClients")}
              value={data.totals.activeClients}
              color="emerald"
            />
            <StatCard
              icon={<HiXCircle />}
              label={t("dashboard.blockedClients")}
              value={data.totals.blockedClients}
              color="red"
            />
            <StatCard
              icon={<HiBuildingOffice2 />}
              label={t("dashboard.totalCenters")}
              value={data.totals.centers}
              color="violet"
            />
            <StatCard
              icon={<HiUserGroup />}
              label={t("dashboard.totalStaff")}
              value={data.totals.staff}
              color="amber"
            />
            <StatCard
              icon={<HiClock />}
              label={t("dashboard.totalStudents")}
              value={data.totals.students}
              color="slate"
            />
          </div>

          {/* Chartlar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <RevenueTrendChart data={data.revenueChart} />
            <ClientGrowthChart data={data.clientGrowth} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <DistributionDonut
              title={t("dashboard.tariffDistributionTitle")}
              items={data.tariffDistribution.map((t2) => ({ label: t2.tariff, value: t2.count }))}
              emptyText={t("dashboard.tariffDistributionEmpty")}
            />
            <DistributionDonut
              title={t("dashboard.subscriptionStatusTitle")}
              items={data.subscriptionStatus.map((s) => ({
                label: t(`dashboard.status${s.status.charAt(0).toUpperCase()}${s.status.slice(1)}`),
                value: s.count,
                color: STATUS_COLORS[s.status],
              }))}
              emptyText={t("dashboard.tariffDistributionEmpty")}
            />
            <div className="lg:col-span-1">
              <RecentClients clients={data.recentClients} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Dashboard;
