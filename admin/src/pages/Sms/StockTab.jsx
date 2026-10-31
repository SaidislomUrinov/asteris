import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiExclamationTriangle } from "react-icons/hi2";
import Button from "../../ui/Button";
import Input from "../../ui/Input";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import { fmtNum } from "./smsMeta";

const Stat = ({ label, value, danger, className = "" }) => (
  <div
    className={`flex flex-col gap-0.5 p-3.5 rounded-xl border bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${danger ? "border-red-300 bg-red-50" : "border-slate-200"} ${className}`}
  >
    <span className={`text-xs font-medium ${danger ? "text-red-500" : "text-slate-400"}`}>{label}</span>
    <span className={`text-xl font-bold tabular-nums ${danger ? "text-red-600" : "text-slate-800"}`}>{value}</span>
  </div>
);

// Zaxira: sotilgan / yuborilgan / getsms'dan sotib olingan / qoldiq / tushum.
function StockTab() {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchased, setPurchased] = useState("");
  const [threshold, setThreshold] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/sms/stats");
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setStats(data);
      setPurchased(data.gatewayPurchased ?? 0);
      setThreshold(data.lowThreshold ?? 0);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(fetchStats, 0);
    return () => clearTimeout(timer);
  }, [fetchStats]);

  const save = async () => {
    try {
      setSaving(true);
      const res = await api.put("/admin/sms/stats", {
        gatewayPurchased: Number(purchased) || 0,
        lowThreshold: Number(threshold) || 0,
      });
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      fetchStats();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={`h-[74px] rounded-xl bg-slate-100 animate-pulse ${i === 4 ? "col-span-2 lg:col-span-1" : ""}`} />
          ))}
        </div>
        <div className="h-36 rounded-xl bg-slate-100 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {stats?.low && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl border border-red-300 bg-red-50 text-sm font-semibold text-red-700">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-500 text-white shrink-0">
            <HiExclamationTriangle className="text-lg" />
          </span>
          {t("sms.stockLow", { count: fmtNum(stats.gatewayRemaining) })}
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label={t("sms.stockSold")} value={fmtNum(stats?.sold)} />
        <Stat label={t("sms.stockSent")} value={fmtNum(stats?.sentSegments)} />
        <Stat label={t("sms.stockRefunded")} value={fmtNum(stats?.refundedSegments)} />
        <Stat label={t("sms.stockRemaining")} value={fmtNum(stats?.gatewayRemaining)} danger={stats?.low} />
        <Stat label={t("sms.stockRevenue")} value={`${fmtNum(stats?.revenue)} ${t("sms.som")}`} className="col-span-2 lg:col-span-1" />
      </div>
      <div className="flex flex-col gap-3 p-4 rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            type="number"
            min={0}
            label={t("sms.gatewayPurchased")}
            value={purchased}
            onChange={(e) => setPurchased(e.target.value)}
          />
          <Input type="number" min={0} label={t("sms.lowThreshold")} value={threshold} onChange={(e) => setThreshold(e.target.value)} />
        </div>
        <div className="flex justify-end">
          <Button loading={saving} onClick={save}>
            {t("common.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default StockTab;
