import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import useQueryState from "../../hooks/useQueryState";
import { HiBanknotes, HiMagnifyingGlass, HiReceiptPercent, HiUserCircle, HiXMark } from "react-icons/hi2";
import { useNavigate } from "react-router-dom";
import Input from "../../ui/Input";
import DateRangeInput from "../../ui/DateRangeInput";
import Button from "../../ui/Button";
import Chip from "../../ui/Chip";
import List from "../../ui/List";
import Select from "../../ui/Select";
import FilterBar from "../../ui/FilterBar";
import useMediaQuery from "../../hooks/useMediaQuery";
import NumberText from "../../ui/NumberText";
import ExportExcelButton from "../../ui/ExportExcelButton";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import useHideFinance from "../../hooks/useHideFinance";
import { api } from "../../utils/fetching";
import { errorMsg } from "../../utils/alert";
import { maskMoney } from "../../utils/moneyFormat";


const TYPES = ["cash", "card", "mixed", "previousMonth"];
const TYPE_COLOR = { cash: "emerald", card: "blue", mixed: "violet", previousMonth: "slate" };
const STATUS_COLOR = { paid: "emerald", cancelled: "red", refunded: "orange" };

const formatUnix = (unix) =>
  unix ? new Date(unix * 1000).toLocaleString("uz-UZ", { dateStyle: "short", timeStyle: "short" }) : "—";

// "Tushumlar" — faqat Client Owner ko'radi (App.jsx'da route ham shunday
// yopilgan, backend `requireOwner` bilan). Har bir tranzaksiya yonida uni
// KIM qabul qilgani ko'rsatiladi. Eski to'lovlarda bu ma'lumot yo'q —
// moliyaviy yozuvlar qayta yozilmaydi, shuning uchun "Noma'lum" deb turadi.
function Revenue() {
  const { t } = useTranslation();
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const navigate = useNavigate();
  const [hideFinance] = useHideFinance();
  const money = (v) => maskMoney(v, hideFinance);

  const [rows, setRows] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [byCollector, setByCollector] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useQueryState("page", 1);
  const [search, setSearch] = useQueryState("search", "");
  const [filterCenter, setFilterCenter] = useQueryState("filterCenter", "");
  const [filterType, setFilterType] = useQueryState("filterType", "");
  const [filterCollector, setFilterCollector] = useQueryState("filterCollector", "");
  const [from, setFrom] = useQueryState("from", "");
  const [to, setTo] = useQueryState("to", "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [centers, setCenters] = useState([]);
  const showCenterFilter = centers.length > 1;

  const params = { search, center: filterCenter, type: filterType, collectedBy: filterCollector, from, to };

  const fetchRevenue = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await api.get("/students/revenue", {
        params: { page, search, center: filterCenter, type: filterType, collectedBy: filterCollector, from, to },
      });
      const { ok, data, totalAmount: total, byCollector: collectors, meta: m, msg } = res.data;
      if (!ok) throw new Error(msg);
      setRows(data || []);
      setTotalAmount(total || 0);
      setByCollector(collectors || []);
      setMeta(m || { page: 1, totalPages: 1, total: 0 });
    } catch (error) {
      setError(true);
      errorMsg(error.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, filterCenter, filterType, filterCollector, from, to]);

  const fetchCenters = useCallback(async () => {
    try {
      const res = await api.get("/centers", { params: { page: 1 } });
      const { ok, data } = res.data;
      if (ok) setCenters(data || []);
    } catch {
      // markazlar ro'yxati faqat filtr uchun
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(fetchRevenue, 0);
    return () => clearTimeout(t);
  }, [fetchRevenue]);

  useEffect(() => {
    const t = setTimeout(fetchCenters, 0);
    return () => clearTimeout(t);
  }, [fetchCenters]);

  // Kassada to'lov qabul qilinishi bilan sahifa o'zi yangilanadi.
  useSocketEvent("payment:created", fetchRevenue);
  useSocketEvent("payment:cancelled", fetchRevenue);
  useSocketEvent("payment:updated", fetchRevenue);

  const resetFilters = () => {
    setPage(1);
    setSearch("");
    setFilterCenter("");
    setFilterType("");
    setFilterCollector("");
    setFrom("");
    setTo("");
  };

  const columns = [
    {
      key: "student",
      header: t("revenue.student"),
      render: (row) => (
        <button
          onClick={() => navigate(`/students/${row.studentId}`)}
          className="flex flex-col items-start cursor-pointer text-left hover:text-blue-600 dark:hover:text-blue-400 duration-200"
        >
          <span className="font-semibold text-slate-800 dark:text-slate-100">{row.studentName}</span>
          <span className="text-xs text-slate-400 dark:text-slate-500">{row.phone}</span>
        </button>
      ),
    },
    {
      key: "center",
      header: t("revenue.center"),
      render: (row) => row.centerName || "—",
    },
    {
      key: "amount",
      header: t("revenue.amount"),
      render: (row) => (
        <NumberText className={row.status !== "paid" ? "line-through text-slate-400 dark:text-slate-500" : ""}>
          {money(row.amount)}
        </NumberText>
      ),
    },
    {
      key: "type",
      header: t("revenue.type"),
      render: (row) => <Chip value={t(`revenue.types.${row.type}`)} color={TYPE_COLOR[row.type] || "slate"} />,
    },
    {
      key: "forMonth",
      header: t("revenue.forMonth"),
      render: (row) => <span className="text-slate-500 dark:text-slate-400 text-xs">{row.forMonth || "—"}</span>,
    },
    {
      key: "collectedBy",
      header: t("revenue.collectedBy"),
      render: (row) =>
        row.collectedBy ? (
          <div className="flex flex-col">
            <span className="text-slate-800 dark:text-slate-100">{row.collectedBy.name}</span>
            <span className="text-xs text-slate-400 dark:text-slate-500">{t(`revenue.roles.${row.collectedBy.role}`)}</span>
          </div>
        ) : (
          <span className="text-slate-400 dark:text-slate-500 text-xs">{t("revenue.collectorUnknown")}</span>
        ),
    },
    {
      key: "date",
      header: t("revenue.date"),
      render: (row) => <span className="text-slate-500 dark:text-slate-400 text-xs">{formatUnix(row.date)}</span>,
    },
    {
      key: "status",
      header: t("common.status"),
      render: (row) => <Chip value={t(`revenue.statuses.${row.status}`)} color={STATUS_COLOR[row.status]} />,
    },
  ];

  return (
    <div className="flex flex-col w-full h-full gap-4">
      {/* Jamlanma — filtr doirasidagi natija bir qarashda ko'rinadi */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
        <SummaryCard
          icon={<HiBanknotes />}
          tone="emerald"
          label={t("revenue.total")}
          value={money(totalAmount)}
          suffix={t("student.somSuffix")}
        />
        <SummaryCard
          icon={<HiReceiptPercent />}
          tone="blue"
          label={t("revenue.transactionCount")}
          value={meta.total}
        />
        <SummaryCard
          icon={<HiUserCircle />}
          tone="slate"
          label={t("revenue.average")}
          value={money(meta.total ? Math.round(totalAmount / meta.total) : 0)}
          suffix={t("student.somSuffix")}
        />
      </div>

      {isDesktop ? (
        <div className={`flex flex-col gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 shadow-sm dark:shadow-none shadow-slate-900/[0.02]`}>
          {/* Filtr qatori konvensiyasi: maydonlar flex-1 (tor ekranda yangi
              qatorga o'tadi), amallar bitta guruhda ml-auto bilan o'ngda. */}
          <div className="flex flex-wrap items-center gap-2.5 [&>*]:flex-1 [&>*]:min-w-[200px]">
            <Input
              placeholder={t("common.search")}
              icon={<HiMagnifyingGlass />}
              variant="slate"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
            />
            {/* "Dan — gacha" bitta maydonda (react-day-picker) */}
            <div className="flex flex-col gap-1 w-full">
              <DateRangeInput
                variant="slate"
                value={{ from, to }}
                onChange={(v) => {
                  setPage(1);
                  setFrom(v.from);
                  setTo(v.to);
                }}
              />
            </div>
            {showCenterFilter && (
              <Select
                placeholder={t("revenue.center")}
                variant="slate"
                value={filterCenter}
                onChange={(v) => {
                  setPage(1);
                  setFilterCenter(v);
                }}
                options={[
                  { value: "", label: t("common.all") },
                  ...centers.map((c) => ({ value: c._id, label: c.name })),
                ]}
              />
            )}
            <Select
              placeholder={t("revenue.type")}
              variant="slate"
              value={filterType}
              onChange={(v) => {
                setPage(1);
                setFilterType(v);
              }}
              options={[
                { value: "", label: t("common.all") },
                ...TYPES.map((v) => ({ value: v, label: t(`revenue.types.${v}`) })),
              ]}
            />
            <Select
              placeholder={t("revenue.collectedBy")}
              variant="slate"
              value={filterCollector}
              onChange={(v) => {
                setPage(1);
                setFilterCollector(v);
              }}
              options={[
                { value: "", label: t("common.all") },
                ...byCollector.map((c) => ({
                  value: c.id || "unknown",
                  label: c.name || t("revenue.collectorUnknown"),
                })),
              ]}
            />
            <div className="!flex-none !min-w-0">
              <Button
                variant="outlined"
                color="red"
                onClick={resetFilters}
                disabled={[filterCenter, filterType, filterCollector, from || to].filter(Boolean).length === 0}
                className="gap-1.5"
              >
                <HiXMark className="text-base" />
                {t("common.resetFilters")}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <FilterBar
          cols={4}
          activeCount={[filterCenter, filterType, filterCollector, from || to].filter(Boolean).length}
          onReset={resetFilters}
          search={
            <Input
              placeholder={t("common.search")}
              icon={<HiMagnifyingGlass />}
              variant="slate"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
            />
          }
        >
          {/* "Dan — gacha" bitta maydonda (react-day-picker) */}
          <div className="flex flex-col gap-1 w-full">
            <DateRangeInput
              variant="slate"
              value={{ from, to }}
              onChange={(v) => {
                setPage(1);
                setFrom(v.from);
                setTo(v.to);
              }}
            />
          </div>
          {showCenterFilter && (
            <Select
              placeholder={t("revenue.center")}
              variant="slate"
              value={filterCenter}
              onChange={(v) => {
                setPage(1);
                setFilterCenter(v);
              }}
              options={[
                { value: "", label: t("common.all") },
                ...centers.map((c) => ({ value: c._id, label: c.name })),
              ]}
            />
          )}
          <Select
            placeholder={t("revenue.type")}
            variant="slate"
            value={filterType}
            onChange={(v) => {
              setPage(1);
              setFilterType(v);
            }}
            options={[
              { value: "", label: t("common.all") },
              ...TYPES.map((v) => ({ value: v, label: t(`revenue.types.${v}`) })),
            ]}
          />
          <Select
            placeholder={t("revenue.collectedBy")}
            variant="slate"
            value={filterCollector}
            onChange={(v) => {
              setPage(1);
              setFilterCollector(v);
            }}
            options={[
              { value: "", label: t("common.all") },
              ...byCollector.map((c) => ({
                value: c.id || "unknown",
                label: c.name || t("revenue.collectorUnknown"),
              })),
            ]}
          />
        </FilterBar>
      )}

      {error ? (
        <div className="flex flex-col items-center justify-center w-full flex-1 gap-3 text-slate-400 dark:text-slate-500">
          <HiBanknotes className="text-4xl" />
          <p className="text-sm">{t("revenue.loadError")}</p>
          <Button variant="outlined" onClick={fetchRevenue}>
            {t("common.retry")}
          </Button>
        </div>
      ) : (
        <List
          columns={columns}
          rows={rows}
          loading={loading}
          empty={t("revenue.empty")}
          page={meta.page}
          totalPages={meta.totalPages}
          onPageChange={setPage}
          showPagination
          toolbar={<ExportExcelButton endpoint="/students/revenue/export" params={params} />}
        />
      )}
    </div>
  );
}

// Yuqoridagi ixcham jamlanma kartasi — ikon, yorliq va katta raqam.
function SummaryCard({ icon, label, value, suffix, tone = "slate", className = "" }) {
  const tones = {
    emerald: "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    blue: "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400",
    slate: "bg-slate-50 dark:bg-night-800 text-slate-400 dark:text-slate-500",
  };
  return (
    <div
      className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl bg-white dark:bg-night-900 ring-1 ring-slate-200/70 dark:ring-night-700/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none ${className}`}
    >
      <span
        className={`flex items-center justify-center w-10 h-10 shrink-0 rounded-xl text-xl ${tones[tone]}`}
      >
        {icon}
      </span>
      <div className="flex flex-col min-w-0">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
          {label}
        </span>
        <span className="flex items-baseline gap-1 min-w-0">
          <NumberText className="text-lg leading-tight">{value}</NumberText>
          {suffix && <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">{suffix}</span>}
        </span>
      </div>
    </div>
  );
}

export default Revenue;
