import { useCallback, useEffect, useState } from "react";
import useQueryState, { useQueryStates } from "../../hooks/useQueryState";
import { useTranslation } from "react-i18next";
import { HiClipboardDocumentList, HiEye, HiMagnifyingGlass } from "react-icons/hi2";
import Input from "../../ui/Input";
import IconButton from "../../ui/IconButton";
import Button from "../../ui/Button";
import Chip from "../../ui/Chip";
import List from "../../ui/List";
import Select from "../../ui/Select";
import Avatar from "../../ui/Avatar";
import FilterBar from "../../ui/FilterBar";
import DateRangeInput from "../../ui/DateRangeInput";
import ExportExcelButton from "../../ui/ExportExcelButton";
import ChangesDialog from "./ChangesDialog";
import { ACTION_COLOR, verbOf } from "./actionColor";
import useFeature from "../../hooks/useFeature";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { api } from "../../utils/fetching";
import { errorMsg } from "../../utils/alert";

// Audit log — "kim, qachon, nima qildi" (CLAUDE.md). Faqat Client Owner
// ko'radi, backend `requireOwner` bilan yopilgan (docs/API_CONTRACT.md §1.4).
const RANGE_DEFAULTS = { from: "", to: "" };

function AuditLog() {
  const { t } = useTranslation();
  const feature = useFeature();

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useQueryState("page", 1);
  const [search, setSearch] = useQueryState("search", "");
  const [filterCenter, setFilterCenter] = useQueryState("filterCenter", "");
  const [filterActor, setFilterActor] = useQueryState("filterActor", "");
  const [filterAction, setFilterAction] = useQueryState("filterAction", "");
  const [range, setRange] = useQueryStates(RANGE_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [centers, setCenters] = useState([]);
  const [actors, setActors] = useState([]);
  const [actions, setActions] = useState([]);
  const showCenterFilter = centers.length > 1;

  const [selected, setSelected] = useState(null);

  const params = {
    search,
    center: filterCenter,
    actorId: filterActor,
    action: filterAction,
    from: range.from,
    to: range.to,
  };

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await api.get("/audit-logs", {
        params: {
          page,
          search,
          center: filterCenter,
          actorId: filterActor,
          action: filterAction,
          from: range.from,
          to: range.to,
        },
      });
      const { ok, data, meta: m, msg } = res.data;
      if (!ok) throw new Error(msg);
      setRows(data || []);
      setMeta(m || { page: 1, totalPages: 1, total: 0 });
    } catch (error) {
      setError(true);
      errorMsg(error.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, filterCenter, filterActor, filterAction, range.from, range.to]);

  // Filtr variantlari (xodimlar, amal turlari) bir marta olinadi — ro'yxat
  // filtrlanganda o'zgarmaydi, aks holda tanlangan filtr o'zi yo'qolib qolardi.
  const fetchFilters = useCallback(async () => {
    try {
      const res = await api.get("/audit-logs/filters");
      const { ok, data } = res.data;
      if (!ok) return;
      setActors(data?.actors || []);
      setActions(data?.actions || []);
    } catch {
      // filtr variantlari bo'lmasa ham ro'yxat ishlayveradi
    }
  }, []);

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
    const id = setTimeout(fetchLogs, 0);
    return () => clearTimeout(id);
  }, [fetchLogs]);

  useEffect(() => {
    const id = setTimeout(() => {
      fetchFilters();
      fetchCenters();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchFilters, fetchCenters]);

  // Jonli qo'shilish: yangi yozuv ro'yxat BOSHIGA qo'yiladi (audit doim
  // `createdAt` bo'yicha teskari tartibda). Faqat 1-sahifada va filtr
  // qo'yilmagan holatda — aks holda foydalanuvchi ko'rayotgan tanlov buziladi.
  useSocketEvent("audit:created", (log) => {
    const filtered = Boolean(search || filterCenter || filterActor || filterAction || range.from);
    if (page !== 1 || filtered || !log?._id) return;
    setRows((prev) => (prev.some((r) => r._id === log._id) ? prev : [log, ...prev].slice(0, 20)));
    setMeta((m) => ({ ...m, total: (m.total || 0) + 1 }));
  });

  const resetFilters = () => {
    setPage(1);
    setFilterCenter("");
    setFilterActor("");
    setFilterAction("");
    setRange(RANGE_DEFAULTS);
  };

  const columns = [
    {
      key: "actor",
      header: t("audit.actor"),
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <Avatar user={{ _id: row.actor?.id, name: row.actor?.name }} size={32} />
          <div className="flex flex-col">
            <span className="font-semibold text-slate-800 dark:text-slate-100">{row.actor?.name || "—"}</span>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {row.actor?.role
                ? t(`audit.roles.${row.actor.role}`, { defaultValue: row.actor.role })
                : t(`audit.kinds.${row.actor?.kind}`, { defaultValue: row.actor?.kind || "" })}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "action",
      header: t("audit.action"),
      render: (row) => (
        <Chip
          value={t(`audit.actions.${row.action}`, { defaultValue: row.action })}
          color={ACTION_COLOR[verbOf(row.action)] || "slate"}
        />
      ),
    },
    {
      key: "entity",
      header: t("audit.entity"),
      render: (row) => (
        <div className="flex flex-col">
          <span className="text-slate-800 dark:text-slate-100">{row.entity?.label || "—"}</span>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {t(`audit.entities.${row.entity?.type}`, { defaultValue: row.entity?.type || "" })}
          </span>
        </div>
      ),
    },
    {
      key: "center",
      header: t("audit.center"),
      render: (row) => <span className="text-slate-500 dark:text-slate-400">{row.center?.name || "—"}</span>,
    },
    {
      key: "date",
      header: t("audit.date"),
      render: (row) => <span className="text-slate-500 dark:text-slate-400 text-xs">{row.date || "—"}</span>,
    },
    {
      // Tafsilot `Dialog` ichida ochiladi. `ui/List` qator bosilishini
      // qo'llab-quvvatlamaydi, shuning uchun ochish tugmasi alohida ustunda —
      // qolaversa mobil ekranda ham nishon aniq bo'ladi.
      key: "detail",
      header: "",
      className: "text-right",
      render: (row) => (
        <div className="flex items-center justify-end">
          <IconButton
            color="slate"
            variant="ghost"
            title={t("audit.detailTitle")}
            onClick={() => setSelected(row)}
          >
            <HiEye />
          </IconButton>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col w-full h-full gap-4">
      <FilterBar
        cols={4}
        activeCount={[filterCenter, filterActor, filterAction, range.from || range.to].filter(Boolean).length}
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
        <div className="flex flex-col gap-1 w-full">
          <DateRangeInput
            variant="slate"
            value={range}
            onChange={(v) => {
              setPage(1);
              setRange(v);
            }}
          />
        </div>
        {showCenterFilter && (
          <Select
            placeholder={t("audit.center")}
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
          placeholder={t("audit.actor")}
          variant="slate"
          value={filterActor}
          onChange={(v) => {
            setPage(1);
            setFilterActor(v);
          }}
          options={[
            { value: "", label: t("common.all") },
            ...actors.map((a) => ({ value: a._id, label: a.name })),
          ]}
        />
        <Select
          placeholder={t("audit.action")}
          variant="slate"
          value={filterAction}
          onChange={(v) => {
            setPage(1);
            setFilterAction(v);
          }}
          options={[
            { value: "", label: t("common.all") },
            ...actions.map((a) => ({
              value: a,
              label: t(`audit.actions.${a}`, { defaultValue: a }),
            })),
          ]}
        />
      </FilterBar>

      {error ? (
        <div className="flex flex-col items-center justify-center w-full flex-1 gap-3 text-slate-400 dark:text-slate-500">
          <HiClipboardDocumentList className="text-4xl" />
          <p className="text-sm">{t("audit.loadError")}</p>
          <Button variant="outlined" onClick={fetchLogs}>
            {t("common.retry")}
          </Button>
        </div>
      ) : (
        <List
          columns={columns}
          rows={rows}
          loading={loading}
          empty={t("audit.empty")}
          page={meta.page}
          totalPages={meta.totalPages}
          onPageChange={setPage}
          showPagination
          toolbar={
            feature("excel.export") ? (
              <ExportExcelButton endpoint="/audit-logs/export" params={params} />
            ) : null
          }
        />
      )}

      <ChangesDialog open={!!selected} log={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

export default AuditLog;
