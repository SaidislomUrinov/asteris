import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiCircleStack,
  HiBolt,
  HiSignal,
  HiFolderOpen,
  HiCpuChip,
  HiBuildingOffice2,
  HiArrowPath,
  HiExclamationTriangle,
} from "react-icons/hi2";
import { api } from "../../utils/fetching";
import Button from "../../ui/Button";
import Select from "../../ui/Select";
import Chip from "../../ui/Chip";
import StatusCard from "./StatusCard";
import MetricsChart from "./MetricsChart";

const POLL_MS = 10_000;

const OVERALL_COLOR = { healthy: "emerald", degraded: "yellow", down: "red" };

const mb = (n) => (n === undefined || n === null ? null : `${Math.round(n)} MB`);
const num = (n) => (n === undefined || n === null ? null : Number(n).toLocaleString("uz-UZ"));

export default function Monitoring() {
  const { t } = useTranslation();

  const [snapshot, setSnapshot] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState("");
  const [hours, setHours] = useState("24");

  // Poll interval ichidan eng so'nggi fetch funksiyasiga tegish uchun
  const fetchRef = useRef(() => {});

  const fetchSnapshot = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await api.get("/admin/monitoring");
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setSnapshot(data);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async (silent = false) => {
    try {
      if (!silent) setHistoryLoading(true);
      const res = await api.get("/admin/monitoring/history", {
        params: { hours },
      });
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setHistory(Array.isArray(data) ? data : []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [hours]);

  useEffect(() => {
    fetchRef.current = () => {
      fetchSnapshot(true);
      fetchHistory(true);
    };
  });

  useEffect(() => {
    // setTimeout — effect tanasida to'g'ridan-to'g'ri setState chaqirilmasligi uchun
    const first = setTimeout(() => fetchSnapshot(), 0);
    // Socket emas — monitoring poll uchun mos (har sekund emit qilish ortiqcha yuk)
    const interval = setInterval(() => fetchRef.current(), POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => fetchHistory(), 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hours]);

  const s = snapshot || {};
  const statusText = (v) => t(`monitoring.status.${v}`, v || "—");

  const uptimeText = (sec) => {
    if (!sec && sec !== 0) return "—";
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return [d ? `${d}${t("monitoring.unitDay")}` : "", h ? `${h}${t("monitoring.unitHour")}` : "", `${m}${t("monitoring.unitMin")}`]
      .filter(Boolean)
      .join(" ");
  };

  return (
    <div className="flex flex-col w-full gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 w-full shrink-0">
        <div className="flex items-center gap-2">
          <p className="text-[18px] font-semibold text-slate-800">
            {t("monitoring.title")}
          </p>
          {snapshot && (
            <Chip
              value={statusText(s.status)}
              color={OVERALL_COLOR[s.status] || "slate"}
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-[12px] text-slate-400">
            {t("monitoring.autoRefresh")}
          </span>
          <Button color="slate" variant="ghost" onClick={() => fetchRef.current()}>
            <HiArrowPath className="text-base" />
            {t("common.refresh")}
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-2 w-full bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-sm">
          <span className="flex items-center gap-2">
            <HiExclamationTriangle className="text-base shrink-0" />
            {t(error, t("monitoring.loadError"))}
          </span>
          <Button color="red" variant="text" onClick={() => fetchSnapshot()}>
            {t("common.retry")}
          </Button>
        </div>
      )}

      {loading && !snapshot ? (
        <SkeletonGrid />
      ) : !snapshot ? (
        <div className="flex items-center justify-center w-full h-40 bg-white border border-slate-200 rounded-xl text-slate-400 text-sm">
          {t("monitoring.empty")}
        </div>
      ) : (
        <>
          {/* Xizmatlar holati */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 w-full">
            <StatusCard
              title={t("monitoring.mongo")}
              icon={<HiCircleStack />}
              status={s.mongo?.status}
              statusText={statusText(s.mongo?.status)}
              latencyMs={s.mongo?.latencyMs}
              latencyLabel={t("monitoring.latency")}
              rows={[
                { label: t("monitoring.dbName"), value: s.mongo?.dbName },
                { label: t("monitoring.collections"), value: num(s.mongo?.collections) },
                { label: t("monitoring.dataSize"), value: mb(s.mongo?.dataSizeMb) },
                { label: t("monitoring.indexSize"), value: mb(s.mongo?.indexSizeMb) },
                { label: t("monitoring.connections"), value: num(s.mongo?.connections) },
              ]}
            />
            <StatusCard
              title={t("monitoring.redis")}
              icon={<HiBolt />}
              status={s.redis?.status}
              statusText={statusText(s.redis?.status)}
              latencyMs={s.redis?.latencyMs}
              latencyLabel={t("monitoring.latency")}
              rows={[
                { label: t("monitoring.usedMemory"), value: mb(s.redis?.usedMemoryMb) },
                { label: t("monitoring.keys"), value: num(s.redis?.keys) },
                {
                  label: t("monitoring.hitRate"),
                  value: s.redis?.hitRate != null ? `${s.redis.hitRate}%` : null,
                },
                { label: t("monitoring.evictedKeys"), value: num(s.redis?.evictedKeys) },
              ]}
            />
            <StatusCard
              title={t("monitoring.socket")}
              icon={<HiSignal />}
              status={s.socket?.status}
              statusText={statusText(s.socket?.status)}
              rows={[
                { label: t("monitoring.connectedSockets"), value: num(s.socket?.connectedSockets) },
                { label: t("monitoring.rooms"), value: num(s.socket?.rooms) },
                { label: t("monitoring.adapter"), value: s.socket?.adapter },
              ]}
            />
            <StatusCard
              title={t("monitoring.storage")}
              icon={<HiFolderOpen />}
              status={s.storage?.status}
              statusText={statusText(s.storage?.status)}
              rows={[
                { label: t("monitoring.path"), value: s.storage?.path },
                { label: t("monitoring.used"), value: mb(s.storage?.usedMb) },
                { label: t("monitoring.free"), value: mb(s.storage?.freeMb) },
                { label: t("monitoring.total"), value: mb(s.storage?.totalMb) },
                { label: t("monitoring.filesCount"), value: num(s.storage?.filesCount) },
              ]}
            />
          </div>

          {/* Grafiklar */}
          <div className="flex flex-wrap items-center justify-between gap-2 w-full">
            <p className="text-[15px] font-semibold text-slate-800">
              {t("monitoring.charts")}
            </p>
            <div className="w-40">
              <Select
                value={hours}
                onChange={setHours}
                options={[
                  { value: "1", label: t("monitoring.lastHours", { count: 1 }) },
                  { value: "6", label: t("monitoring.lastHours", { count: 6 }) },
                  { value: "24", label: t("monitoring.lastHours", { count: 24 }) },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
            <MetricsChart
              title={t("monitoring.rps")}
              values={history.map((h) => h.rps)}
              color="blue"
              suffix=""
              loading={historyLoading}
              emptyText={t("monitoring.noHistory")}
            />
            <MetricsChart
              title={t("monitoring.avgLatency")}
              values={history.map((h) => h.mongo ?? h.latency)}
              color="emerald"
              suffix=" ms"
              loading={historyLoading}
              emptyText={t("monitoring.noHistory")}
            />
            <MetricsChart
              title={t("monitoring.errorRate")}
              values={history.map((h) => h.errorRate)}
              color="red"
              suffix="%"
              loading={historyLoading}
              emptyText={t("monitoring.noHistory")}
            />
          </div>

          {/* Process + API + Tenants */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 w-full">
            <InfoBlock
              title={t("monitoring.process")}
              icon={<HiCpuChip />}
              rows={[
                { label: t("monitoring.uptime"), value: uptimeText(s.uptime) },
                { label: t("monitoring.version"), value: s.version },
                { label: t("monitoring.nodeVersion"), value: s.nodeVersion },
                { label: "PID", value: s.pid },
                { label: t("monitoring.workers"), value: num(s.workers) },
                {
                  label: t("monitoring.cpu"),
                  value: s.process?.cpuPercent != null ? `${s.process.cpuPercent}%` : null,
                },
                { label: t("monitoring.memory"), value: mb(s.process?.memoryMb) },
                {
                  label: t("monitoring.heap"),
                  value:
                    s.process?.heapUsedMb != null
                      ? `${Math.round(s.process.heapUsedMb)} / ${Math.round(s.process.heapTotalMb || 0)} MB`
                      : null,
                },
                {
                  label: t("monitoring.loadAvg"),
                  value: s.process?.loadAvg
                    ? s.process.loadAvg.map((n) => Number(n).toFixed(2)).join(" · ")
                    : null,
                },
              ]}
            />
            <InfoBlock
              title={t("monitoring.api")}
              icon={<HiSignal />}
              rows={[
                { label: t("monitoring.rpm"), value: num(s.api?.rpm) },
                {
                  label: t("monitoring.avgLatency"),
                  value: s.api?.avgLatencyMs != null ? `${s.api.avgLatencyMs} ms` : null,
                },
                {
                  label: t("monitoring.errorRate"),
                  value: s.api?.errorRate != null ? `${s.api.errorRate}%` : null,
                },
                { label: "2xx", value: num(s.api?.statusCounts?.["2xx"]) },
                { label: "4xx", value: num(s.api?.statusCounts?.["4xx"]) },
                { label: "5xx", value: num(s.api?.statusCounts?.["5xx"]) },
              ]}
            />
            <InfoBlock
              title={t("monitoring.tenants")}
              icon={<HiBuildingOffice2 />}
              rows={[
                { label: t("monitoring.clients"), value: num(s.tenants?.clients) },
                {
                  label: t("monitoring.activeSubscriptions"),
                  value: num(s.tenants?.activeSubscriptions),
                },
                { label: t("monitoring.expiringSoon"), value: num(s.tenants?.expiringSoon) },
                { label: t("monitoring.blockedCenters"), value: num(s.tenants?.blockedCenters) },
              ]}
            />
          </div>
        </>
      )}
    </div>
  );
}

function InfoBlock({ title, icon, rows }) {
  return (
    <div className="flex flex-col gap-3 bg-white border border-slate-200 rounded-xl p-4 w-full">
      <div className="flex items-center gap-2">
        <span className="text-slate-400 text-lg">{icon}</span>
        <span className="font-semibold text-slate-800">{title}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-2 text-[13px]">
            <span className="text-slate-400 truncate">{r.label}</span>
            <span className="text-slate-700 font-medium whitespace-nowrap truncate max-w-[60%]">
              {r.value ?? "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 w-full">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-45 bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3"
          >
            <div className="h-4 w-1/3 rounded bg-slate-100 animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-slate-100 animate-pulse" />
            <div className="flex-1 rounded bg-slate-50 animate-pulse" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-32 bg-white border border-slate-200 rounded-xl animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
