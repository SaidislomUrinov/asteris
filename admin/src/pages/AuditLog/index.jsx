import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiMagnifyingGlass,
  HiArrowPath,
  HiArrowDownTray,
  HiExclamationTriangle,
  HiFunnel,
  HiXMark,
  HiEye,
} from "react-icons/hi2";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import socket from "../../socket";
import Input from "../../ui/Input";
import Select from "../../ui/Select";
import Button from "../../ui/Button";
import IconButton from "../../ui/IconButton";
import Chip from "../../ui/Chip";
import List from "../../ui/List";
import SearchSelect from "../../ui/SearchSelect";
import ChangesDialog from "./ChangesDialog";
import { actionColor, ACTOR_KINDS } from "./actionMeta";

const EMPTY_FILTERS = { actors: [], actions: [], entityTypes: [] };

export default function AuditLog() {
  const { t } = useTranslation();

  const [logs, setLogs] = useState([]);
  const [meta, setMeta] = useState({ page: 1, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [actorId, setActorId] = useState("");
  const [actorKind, setActorKind] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [activeLog, setActiveLog] = useState(null);

  const isSearching = !!search.trim();
  const fetchRef = useRef(() => {});

  const params = {
    page,
    search,
    from,
    to,
    clientId,
    actorId,
    actorKind,
    action,
    entityType,
  };

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/admin/audit-logs", { params });
      const { ok, data, meta: m, msg } = res.data;
      if (!ok) throw new Error(msg);
      setLogs(data || []);
      setMeta(m || { page: 1, total: 0, totalPages: 1 });
    } catch (err) {
      setError(err.message);
      setLogs([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, from, to, clientId, actorId, actorKind, action, entityType]);

  useEffect(() => {
    fetchRef.current = fetchLogs;
  });

  useEffect(() => {
    const timeout = setTimeout(fetchLogs, isSearching ? 350 : 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, from, to, clientId, actorId, actorKind, action, entityType]);

  // Filtr variantlari — clientId o'zgarganda qayta olinadi (aktyorlar tenantga bog'liq)
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/admin/audit-logs/filters", {
          params: { clientId },
        });
        if (res.data?.ok) setFilters({ ...EMPTY_FILTERS, ...res.data.data });
      } catch {
        // filtr variantlari kelmasa ham ro'yxat ishlashda davom etadi
      }
    })();
  }, [clientId]);

  // Realtime — yangi audit yozuvi ro'yxat boshiga qo'shiladi (faqat 1-sahifada)
  useEffect(() => {
    const onCreated = (log) => {
      setPage((p) => {
        if (p !== 1) return p;
        setLogs((prev) => [log, ...prev].slice(0, 20));
        setMeta((m) => ({ ...m, total: (m.total || 0) + 1 }));
        return p;
      });
    };
    socket.on("audit:created", onCreated);
    return () => socket.off("audit:created", onCreated);
  }, []);

  const searchClients = async (q) => {
    try {
      const res = await api.get("/clients", { params: { search: q, limit: 20 } });
      if (!res.data?.ok) return [];
      return (res.data.data || []).map((c) => ({
        value: c._id,
        label: c.name,
        sub: c.phone,
      }));
    } catch {
      return [];
    }
  };

  const resetFilters = () => {
    setPage(1);
    setSearch("");
    setFrom("");
    setTo("");
    setClientId("");
    setClientName("");
    setActorId("");
    setActorKind("");
    setAction("");
    setEntityType("");
  };

  const exportExcel = async () => {
    try {
      setExporting(true);
      const res = await api.get("/admin/audit-logs/export", {
        params,
        responseType: "blob",
      });
      const url = URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `audit-log-${Date.now()}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      successMsg("audit.exported");
    } catch (err) {
      errorMsg(err.message);
    } finally {
      setExporting(false);
    }
  };

  const onFilterChange = (setter) => (value) => {
    setPage(1);
    setter(value);
  };

  const columns = [
    {
      key: "actor",
      header: t("audit.actor"),
      className: "font-medium text-slate-800",
      render: (log) => (
        <div className="flex flex-col gap-0.5">
          <span>{log.actor?.name || "—"}</span>
          <span className="text-[11px] text-slate-400">
            {t(`audit.kinds.${log.actor?.kind}`, log.actor?.kind || "")}
            {log.actor?.role ? ` · ${t(`audit.roles.${log.actor.role}`, log.actor.role)}` : ""}
          </span>
        </div>
      ),
    },
    {
      key: "action",
      header: t("audit.action"),
      render: (log) => (
        <Chip
          value={t(`audit.actions.${log.action}`, log.action)}
          color={actionColor(log.action)}
        />
      ),
    },
    {
      key: "entity",
      header: t("audit.entity"),
      className: "text-slate-600",
      render: (log) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-slate-700">
            {t(`audit.entities.${log.entity?.type}`, log.entity?.type || "—")}
          </span>
          {log.entity?.label && (
            <span className="text-[11px] text-slate-400">{log.entity.label}</span>
          )}
        </div>
      ),
    },
    {
      key: "client",
      header: t("audit.client"),
      className: "text-slate-600",
      render: (log) =>
        log.client?.name ? (
          <div className="flex flex-col gap-0.5">
            <span>{log.client.name}</span>
            {log.center?.name && (
              <span className="text-[11px] text-slate-400">{log.center.name}</span>
            )}
          </div>
        ) : (
          <span className="text-slate-300">{t("audit.platformLevel")}</span>
        ),
    },
    {
      key: "changes",
      header: t("audit.changes"),
      className: "text-slate-500",
      render: (log) =>
        log.changes?.length ? (
          <span className="text-slate-600">
            {t("audit.changesCount", { count: log.changes.length })}
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        ),
    },
    {
      key: "date",
      header: t("audit.date"),
      className: "text-slate-500",
      render: (log) => log.date,
    },
    {
      key: "actions",
      header: t("common.actions"),
      className: "text-right",
      render: (log) => (
        <IconButton
          variant="ghost"
          title={t("audit.detailTitle")}
          onClick={() => setActiveLog(log)}
        >
          <HiEye />
        </IconButton>
      ),
    },
  ];

  const filterFields = (
    <>
      <Input
        placeholder={t("audit.searchPlaceholder")}
        icon={<HiMagnifyingGlass />}
        value={search}
        onChange={(e) => {
          setPage(1);
          setSearch(e.target.value);
        }}
      />
      <Input
        type="date"
        label={t("audit.from")}
        value={from}
        onChange={(e) => onFilterChange(setFrom)(e.target.value)}
      />
      <Input
        type="date"
        label={t("audit.to")}
        value={to}
        onChange={(e) => onFilterChange(setTo)(e.target.value)}
      />
      <SearchSelect
        value={clientId}
        displayValue={clientName}
        placeholder={t("audit.allClients")}
        searchPlaceholder={t("audit.searchClient")}
        onSearch={searchClients}
        onChange={(v, item) => {
          setPage(1);
          setClientId(v);
          setClientName(item?.label || "");
          setActorId("");
        }}
      />
      <Select
        placeholder={t("audit.allActorKinds")}
        value={actorKind}
        onChange={onFilterChange(setActorKind)}
        options={[
          { value: "", label: t("audit.allActorKinds") },
          ...ACTOR_KINDS.map((k) => ({ value: k, label: t(`audit.kinds.${k}`) })),
        ]}
      />
      <Select
        placeholder={t("audit.allActors")}
        value={actorId}
        onChange={onFilterChange(setActorId)}
        options={[
          { value: "", label: t("audit.allActors") },
          ...filters.actors.map((a) => ({
            value: a._id,
            label: a.role ? `${a.name} — ${t(`audit.roles.${a.role}`, a.role)}` : a.name,
          })),
        ]}
      />
      <Select
        placeholder={t("audit.allActions")}
        value={action}
        onChange={onFilterChange(setAction)}
        options={[
          { value: "", label: t("audit.allActions") },
          ...filters.actions.map((a) => ({
            value: a,
            label: t(`audit.actions.${a}`, a),
          })),
        ]}
      />
      <Select
        placeholder={t("audit.allEntityTypes")}
        value={entityType}
        onChange={onFilterChange(setEntityType)}
        options={[
          { value: "", label: t("audit.allEntityTypes") },
          ...filters.entityTypes.map((e) => ({
            value: e,
            label: t(`audit.entities.${e}`, e),
          })),
        ]}
      />
    </>
  );

  return (
    <div className="flex flex-col w-full h-full gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 w-full shrink-0">
        <p className="text-[18px] font-semibold text-slate-800">
          {t("audit.title")}{" "}
          <span className="text-slate-400 text-sm font-normal">({meta.total})</span>
        </p>
        <div className="flex items-center gap-2">
          <div className="md:hidden">
            <Button
              color="slate"
              variant="ghost"
              onClick={() => setMobileFiltersOpen((p) => !p)}
            >
              <HiFunnel className="text-base" />
              {t("common.filters")}
            </Button>
          </div>
          <Button color="slate" variant="ghost" onClick={resetFilters}>
            <HiXMark className="text-base" />
            {t("common.reset")}
          </Button>
          <Button loading={exporting} onClick={exportExcel}>
            <HiArrowDownTray className="text-base" />
            {t("common.export")}
          </Button>
        </div>
      </div>

      {/* Filtrlar — mobilda yig'iladi, md dan boshlab doim ochiq */}
      <div
        className={`${mobileFiltersOpen ? "grid" : "hidden"} md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 bg-white p-2 rounded-xl border border-zinc-200 w-full shrink-0`}
      >
        {filterFields}
      </div>

      {error && (
        <div className="flex items-center justify-between gap-2 w-full shrink-0 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-sm">
          <span className="flex items-center gap-2">
            <HiExclamationTriangle className="text-base shrink-0" />
            {t(error, t("audit.loadError"))}
          </span>
          <Button color="red" variant="text" onClick={() => fetchRef.current()}>
            <HiArrowPath className="text-base" />
            {t("common.retry")}
          </Button>
        </div>
      )}

      <List
        columns={columns}
        rows={logs}
        rowKey={(log) => log._id}
        loading={loading}
        empty={t("audit.empty")}
        page={page}
        totalPages={meta.totalPages}
        total={meta.total}
        onPageChange={setPage}
        showPagination={!isSearching}
      />

      <ChangesDialog log={activeLog} onClose={() => setActiveLog(null)} />
    </div>
  );
}
