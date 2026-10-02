import { useTranslation } from "react-i18next";
import {
  HiArrowTrendingDown,
  HiArrowTrendingUp,
  HiBanknotes,
  HiCheckBadge,
  HiExclamationCircle,
  HiReceiptPercent,
  HiUserGroup,
  HiUserPlus,
} from "react-icons/hi2";
import MetricCard from "../../ui/MetricCard";
import { money, percent } from "./reportData";

// Skeleton — MetricCard bilan bir xil o'lchamda, sahifa "sakramasligi" uchun.
function CardSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-5 pl-6 rounded-2xl bg-white border border-slate-200/80">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-100 animate-pulse" />
        <div className="h-3.5 w-24 rounded bg-slate-100 animate-pulse" />
      </div>
      <div className="h-6 w-32 rounded bg-slate-100 animate-pulse" />
    </div>
  );
}

// O'tgan davrga nisbatan o'zgarish. `comparison` bo'lmasa (birinchi davr)
// umuman ko'rsatilmaydi — 0% deb yozish chalg'itadi.
function Trend({ value, invert = false }) {
  const { t } = useTranslation();
  if (value === null || value === undefined) return null;

  const up = value >= 0;
  const good = invert ? !up : up;
  const Icon = up ? HiArrowTrendingUp : HiArrowTrendingDown;

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold ${
        good ? "text-emerald-600" : "text-red-500"
      }`}
    >
      <Icon className="text-sm" />
      {percent(value)}
      <span className="font-normal text-slate-400">{t("report.vsPrevious")}</span>
    </span>
  );
}

/**
 * Hisobot tepasidagi asosiy ko'rsatkichlar.
 * `/api/reports/summary` javobini shundayligicha oladi.
 */
function SummaryCards({ summary, loading }) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!summary) return null;

  const suffix = t("student.somSuffix");
  const cmp = summary.comparison || {};

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <MetricCard
          icon={<HiBanknotes />}
          accent="emerald"
          title={t("report.revenue")}
          value={money(summary.revenue)}
          suffix={suffix}
        >
          <Trend value={cmp.revenue} />
        </MetricCard>

        <MetricCard
          icon={<HiReceiptPercent />}
          accent="orange"
          title={t("report.expense")}
          value={money(summary.expense)}
          suffix={suffix}
        >
          {/* Xarajat o'sishi — YOMON, shuning uchun rang teskari */}
          <Trend value={cmp.expense} invert />
        </MetricCard>

        <MetricCard
          icon={<HiCheckBadge />}
          accent={summary.profit >= 0 ? "blue" : "red"}
          title={t("report.profit")}
          value={money(summary.profit)}
          suffix={suffix}
        >
          <Trend value={cmp.profit} />
        </MetricCard>

        <MetricCard
          icon={<HiExclamationCircle />}
          accent="red"
          title={t("report.debt")}
          value={money(summary.debt)}
          suffix={suffix}
        >
          <span className="text-xs text-slate-400">{t("report.debtHint")}</span>
        </MetricCard>
      </div>

      {/* Ikkilamchi ko'rsatkichlar — ixcham qatorda */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5">
        <MiniStat
          icon={<HiUserPlus />}
          tone="emerald"
          label={t("report.newStudents")}
          value={summary.newStudents}
        />
        <MiniStat
          icon={<HiUserPlus />}
          tone="red"
          label={t("report.leftStudents")}
          value={summary.leftStudents}
        />
        <MiniStat
          icon={<HiUserGroup />}
          tone="blue"
          label={t("report.activeStudents")}
          value={summary.activeStudents}
        />
        <MiniStat
          icon={<HiUserGroup />}
          tone="violet"
          label={t("report.activeGroups")}
          value={summary.activeGroups}
        />
        <MiniStat
          icon={<HiCheckBadge />}
          tone="cyan"
          label={t("report.attendanceRate")}
          value={`${Math.round(summary.attendanceRate || 0)}%`}
        />
        <MiniStat
          icon={<HiBanknotes />}
          tone="slate"
          label={t("report.salaryPaid")}
          value={money(summary.salaryPaid)}
        />
      </div>
    </div>
  );
}

function MiniStat({ icon, label, value, tone = "slate" }) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    violet: "bg-violet-50 text-violet-600",
    cyan: "bg-cyan-50 text-cyan-600",
    red: "bg-red-50 text-red-600",
    slate: "bg-slate-50 text-slate-400",
  };

  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-2xl bg-white ring-1 ring-slate-200/70">
      <span
        className={`flex items-center justify-center w-9 h-9 shrink-0 rounded-xl text-lg ${tones[tone]}`}
      >
        {icon}
      </span>
      <div className="flex flex-col min-w-0">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 truncate">
          {label}
        </span>
        <span className="font-jet font-semibold text-sm text-slate-900 truncate">{value ?? 0}</span>
      </div>
    </div>
  );
}

export default SummaryCards;
