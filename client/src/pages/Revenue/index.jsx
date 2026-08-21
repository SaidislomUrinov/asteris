import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiBanknotes, HiMagnifyingGlass, HiReceiptPercent, HiUserCircle } from "react-icons/hi2";
import { useNavigate } from "react-router-dom";
import Input from "../../ui/Input";
import DateRangeInput from "../../ui/DateRangeInput";
import Button from "../../ui/Button";
import Chip from "../../ui/Chip";
import List from "../../ui/List";
import Select from "../../ui/Select";
import FilterBar from "../../ui/FilterBar";
import NumberText from "../../ui/NumberText";
import ExportExcelButton from "../../ui/ExportExcelButton";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { api } from "../../utils/fetching";
import { errorMsg } from "../../utils/alert";

const TYPES = ["cash", "card", "mixed", "previousMonth"];
const TYPE_COLOR = { cash: "emerald", card: "blue", mixed: "violet", previousMonth: "slate" };
const STATUS_COLOR = { paid: "emerald", cancelled: "red", refunded: "orange" };

const money = (v) => `${(v || 0).toLocaleString("uz-UZ")}`;
const formatUnix = (unix) =>
  unix ? new Date(unix * 1000).toLocaleString("uz-UZ", { dateStyle: "short", timeStyle: "short" }) : "—";

// "Tushumlar" — faqat Client Owner ko'radi (App.jsx'da route ham shunday
// yopilgan, backend `requireOwner` bilan). Har bir tranzaksiya yonida uni
// KIM qabul qilgani ko'rsatiladi. Eski to'lovlarda bu ma'lumot yo'q —
// moliyaviy yozuvlar qayta yozilmaydi, shuning uchun "Noma'lum" deb turadi.
function Revenue() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [byCollector, setByCollector] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterCenter, setFilterCenter] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterCollector, setFilterCollector] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
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
    fetchRevenue();
  }, [fetchRevenue]);

  useEffect(() => {
    fetchCenters();
  }, [fetchCenters]);

  // Kassada to'lov qabul qilinishi bilan sahifa o'zi yangilanadi.
  useSocketEvent("payment:created", fetchRevenue);
  useSocketEvent("payment:cancelled", fetchRevenue);

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
          className="flex flex-col items-start cursor-pointer text-left hover:text-blue-600 duration-200"
        >
          <span className="font-semibold text-slate-800">{row.studentName}</span>
          <span className="text-xs text-slate-400">{row.phone}</span>
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
        <NumberText className={row.status !== "paid" ? "line-through text-slate-400" : ""}>
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
      render: (row) => <span className="text-slate-500 text-xs">{row.forMonth || "—"}</span>,
    },
    {
      key: "collectedBy",
      header: t("revenue.collectedBy"),
      render: (row) =>
        row.collectedBy ? (
          <div className="flex flex-col">
            <span className="text-slate-800">{row.collectedBy.name}</span>
            <span className="text-xs text-slate-400">{t(`revenue.roles.${row.collectedBy.role}`)}</span>
          </div>
        ) : (
          <span className="text-slate-400 text-xs">{t("revenue.collectorUnknown")}</span>
        ),
    },
    {
      key: "date",
      header: t("revenue.date"),
      render: (row) => <span className="text-slate-500 text-xs">{formatUnix(row.date)}</span>,
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
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
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
          className="max-lg:col-span-2"
        />
      </div>

      <FilterBar
        cols={4}
        activeCount={[filterCenter, filterType, filterCollector, from || to].filter(Boolean).length}
        onReset={resetFilters}
        search={
          <Input
            placeholder={t("common.search")}
            icon={<HiMagnifyingGlass />}
            variant="white"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        }
      >
        {/* "Dan — gacha" bitta maydonda (react-day-picker) */}
        <DateRangeInput
          variant="white"
          value={{ from, to }}
          onChange={(v) => {
            setPage(1);
            setFrom(v.from);
            setTo(v.to);
          }}
        />
        {showCenterFilter && (
          <Select
            placeholder={t("revenue.center")}
            variant="white"
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
          variant="white"
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
          variant="white"
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

      {/* Kim qancha yig'gani — filtr doirasidagi jamlanma. Kartaga bosilsa
          o'sha hodim bo'yicha filtrlanadi (qayta bosilsa — bekor qilinadi). */}
      {byCollector.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {byCollector.map((c) => {
            const id = c.id || "unknown";
            const on = filterCollector === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setPage(1);
                  setFilterCollector(on ? "" : id);
                }}
                className={`flex items-center gap-3 p-3 rounded-2xl bg-white text-left ring-1 cursor-pointer transition-colors duration-150 ${
                  on
                    ? "ring-blue-300 bg-blue-50/40"
                    : "ring-slate-200/70 hover:ring-slate-300 hover:bg-slate-50/60"
                }`}
              >
                <span
                  className={`flex items-center justify-center w-10 h-10 shrink-0 rounded-xl text-xl ${
                    on ? "bg-blue-100 text-blue-600" : "bg-slate-50 text-slate-400"
                  }`}
                >
                  <HiUserCircle />
                </span>
                <span className="flex flex-col min-w-0 flex-1">
                  <span className="text-[13px] font-medium text-slate-500 truncate">
                    {c.name || t("revenue.collectorUnknown")}
                  </span>
                  <NumberText className="text-base leading-tight">{money(c.amount)}</NumberText>
                  <span className="text-[11px] text-slate-400">
                    {t("revenue.transactionCountShort", { count: c.count })}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {error ? (
        <div className="flex flex-col items-center justify-center w-full flex-1 gap-3 text-slate-400">
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
    emerald: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    slate: "bg-slate-50 text-slate-400",
  };
  return (
    <div
      className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl bg-white ring-1 ring-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}
    >
      <span
        className={`flex items-center justify-center w-10 h-10 shrink-0 rounded-xl text-xl ${tones[tone]}`}
      >
        {icon}
      </span>
      <div className="flex flex-col min-w-0">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 truncate">
          {label}
        </span>
        <span className="flex items-baseline gap-1 min-w-0">
          <NumberText className="text-lg leading-tight">{value}</NumberText>
          {suffix && <span className="text-[11px] text-slate-400 shrink-0">{suffix}</span>}
        </span>
      </div>
    </div>
  );
}

export default Revenue;
