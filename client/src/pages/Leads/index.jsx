import { useCallback, useEffect, useMemo, useState } from "react";
import useQueryState, { useQueryStates } from "../../hooks/useQueryState";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  HiArrowRightCircle,
  HiCheck,
  HiInboxStack,
  HiMagnifyingGlass,
  HiNoSymbol,
  HiPencilSquare,
  HiPhone,
  HiPlus,
  HiTrash,
  HiUserGroup,
  HiOutlineViewfinderCircle,
  HiXMark,
} from "react-icons/hi2";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import Chip from "../../ui/Chip";
import List from "../../ui/List";
import Select from "../../ui/Select";
import FilterBar from "../../ui/FilterBar";
import DayPicker from "../../ui/DayPicker";
import DropMenu from "../../ui/DropMenu";
import Checkbox from "../../ui/Checkbox";
import Dialog from "../../ui/Dialog";
import LeadDialog from "./LeadDialog";
import EnrollDialog from "./EnrollDialog";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import useCan from "../../hooks/useCan";
import useMediaQuery from "../../hooks/useMediaQuery";
import useClosingValue from "../../hooks/useClosingValue";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { SOURCES, STATUS_COLOR, TIMES } from "./leadOptions";

const DESKTOP = "(min-width: 640px)";
const OPEN = ["new", "contacted"];

// O'quvchi lidlari — API_CONTRACT_student_leads.md. Asosiy oqim: kelganlarni
// yozib borish → fan/kun/vaqt bo'yicha filtrlash → belgilash → guruh.
// Filtrlar URL query-param'da (useQueryStates) — Detail'dan qaytganda saqlanadi.
const FILTER_DEFAULTS = { center: "", subject: "", status: "", time: "", source: "", level: "", days: [] };

function Leads() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const can = useCan();
  const isDesktop = useMediaQuery(DESKTOP);

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [page, setPage] = useQueryState("page", 1);
  const [search, setSearch] = useQueryState("search", "");
  const [filters, setFilters] = useQueryStates(FILTER_DEFAULTS);

  const [centers, setCenters] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [assistants, setAssistants] = useState([]);
  const [rooms, setRooms] = useState([]);

  // Tanlov sahifa/filtr almashganda ham saqlanadi — id → lid.
  const [selected, setSelected] = useState({});
  const [leadDialog, setLeadDialog] = useState(null); // { lead } | { lead: null }
  const leadDialogView = useClosingValue(leadDialog);
  // Dialog ochilgan paytdagi tanlov nusxasi — socket orqali tanlov tozalansa
  // ham natija oynasi yopilib ketmasligi uchun.
  const [enroll, setEnroll] = useState(null);
  const enrollView = useClosingValue(enroll);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const deleteTargetView = useClosingValue(deleteTarget);
  const [deleting, setDeleting] = useState(false);

  const centerMap = useMemo(() => Object.fromEntries(centers.map((c) => [c._id, c])), [centers]);
  const subjectMap = useMemo(() => Object.fromEntries(subjects.map((s) => [s._id, s])), [subjects]);
  const showCenter = centers.length > 1;

  const setFilter = (key, value) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  };
  const activeFilterCount = Object.entries(filters).filter(([, v]) => (Array.isArray(v) ? v.length : v)).length;
  const resetFilters = () => {
    setPage(1);
    setFilters(FILTER_DEFAULTS);
  };

  const fetchLeads = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        setError(false);
        const [listRes, summaryRes] = await Promise.all([
          api.get("/student-leads", {
            params: { page, search, ...filters, days: filters.days.join(",") },
          }),
          api.get("/student-leads/summary", { params: { center: filters.center } }),
        ]);
        if (!listRes.data.ok) throw new Error(listRes.data.msg);
        setRows(listRes.data.data || []);
        setMeta(listRes.data.meta || { page: 1, totalPages: 1, total: 0 });
        if (summaryRes.data.ok) setSummary(summaryRes.data.data || []);
      } catch (err) {
        setError(true);
        errorMsg(err.message);
      } finally {
        setLoading(false);
      }
    },
    [page, search, filters],
  );

  useEffect(() => {
    const id = setTimeout(fetchLeads, 0);
    return () => clearTimeout(id);
  }, [fetchLeads]);

  useEffect(() => {
    const load = async () => {
      try {
        const [c, s, tch, asst, r] = await Promise.all([
          api.get("/centers", { params: { page: 1 } }),
          api.get("/subjects", { params: { page: 1 } }),
          api.get("/staffs/lookup", { params: { role: "teacher" } }),
          api.get("/staffs/lookup", { params: { role: "assistant" } }),
          api.get("/rooms/lookup"),
        ]);
        if (c.data.ok) setCenters(c.data.data || []);
        if (s.data.ok) setSubjects(s.data.data || []);
        if (tch.data.ok) setTeachers(tch.data.data || []);
        if (asst.data.ok) setAssistants(asst.data.data || []);
        if (r.data.ok) setRooms(r.data.data || []);
      } catch {
        // lookup ro'yxatlari — xato bo'lsa nomlar "—" bo'lib qoladi
      }
    };
    load();
  }, []);

  // Boshqa hodim lid qo'shsa/guruhga olsa — ro'yxat jim yangilanadi.
  useSocketEvent("lead:changed", (payload) => {
    if (payload?.action === "enrolled" || payload?.action === "deleted") {
      setSelected((prev) => {
        const next = { ...prev };
        (payload.ids || []).forEach((id) => delete next[id]);
        return next;
      });
    }
    fetchLeads(true);
  });

  const selectedList = Object.values(selected);
  const selectable = (row) => OPEN.includes(row.status);
  const pageSelectable = rows.filter(selectable);
  const allPageSelected = pageSelectable.length > 0 && pageSelectable.every((r) => selected[r._id]);

  const toggleRow = (row) =>
    setSelected((prev) => {
      const next = { ...prev };
      if (next[row._id]) delete next[row._id];
      else next[row._id] = row;
      return next;
    });
  const togglePage = () =>
    setSelected((prev) => {
      const next = { ...prev };
      if (allPageSelected) pageSelectable.forEach((r) => delete next[r._id]);
      else pageSelectable.forEach((r) => (next[r._id] = r));
      return next;
    });

  // Guruhga faqat bitta filial va bitta fandagi lidlar birga qo'shiladi.
  const selSubjects = [...new Set(selectedList.map((l) => l.subject))];
  const selCenters = [...new Set(selectedList.map((l) => l.center))];
  const mixed = selSubjects.length > 1 || selCenters.length > 1;
  const canEnroll = can("lead:update") && can("student:create");
  const canCreateGroup = canEnroll && can("group:create") && can("group:update");

  const setStatus = async (row, status) => {
    try {
      const res = await api.patch(`/student-leads/${row._id}`, { status });
      if (!res.data.ok) throw new Error(res.data.msg);
      successMsg(res.data.msg);
      fetchLeads(true);
    } catch (err) {
      errorMsg(err.message);
    }
  };

  const confirmDelete = async () => {
    try {
      setDeleting(true);
      const res = await api.delete(`/student-leads/${deleteTarget._id}`);
      if (!res.data.ok) throw new Error(res.data.msg);
      successMsg(res.data.msg);
      setSelected((prev) => {
        const next = { ...prev };
        delete next[deleteTarget._id];
        return next;
      });
      setDeleteTarget(null);
      fetchLeads(true);
    } catch (err) {
      errorMsg(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const openEnroll = (mode) =>
    setEnroll({
      mode,
      leads: selectedList,
      subject: subjectMap[selSubjects[0]],
      center: centerMap[selCenters[0]],
    });

  const closeEnroll = (data) => {
    setEnroll(null);
    if (data?.enrolled?.length) {
      setSelected({});
      if (data.group?._id) navigate(`/groups/${data.group._id}`);
    }
  };

  const preference = (row) => {
    const days = (row.preferredDays || []).map((d) => t(`group.dayShort.${d}`)).join(", ");
    return [days || t("lead.anyDay"), t(`lead.time.${row.preferredTime}`)].join(" · ");
  };

  const rowMenu = (row) => [
    ...(can("lead:update") && row.status !== "enrolled"
      ? [
          { label: t("common.edit"), icon: HiPencilSquare, iconClass: "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400", onClick: () => setLeadDialog({ lead: row }) },
          ...(row.status !== "contacted"
            ? [{ label: t("lead.markContacted"), icon: HiPhone, iconClass: "bg-orange-50 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400", onClick: () => setStatus(row, "contacted") }]
            : []),
          ...(row.status !== "rejected"
            ? [{ label: t("lead.markRejected"), icon: HiNoSymbol, iconClass: "bg-slate-100 dark:bg-night-800 text-slate-600 dark:text-slate-300", onClick: () => setStatus(row, "rejected") }]
            : [{ label: t("lead.reopen"), icon: HiArrowRightCircle, iconClass: "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400", onClick: () => setStatus(row, "new") }]),
        ]
      : []),
    ...(row.status === "enrolled" && row.group
      ? [{ label: t("lead.openGroup"), icon: HiUserGroup, iconClass: "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", onClick: () => navigate(`/groups/${row.group}`) }]
      : []),
    ...(can("lead:delete")
      ? [{ label: t("common.delete"), icon: HiTrash, iconClass: "bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400", onClick: () => setDeleteTarget(row) }]
      : []),
  ];

  const statusChip = (row) => <Chip value={t(`lead.status.${row.status}`)} color={STATUS_COLOR[row.status]} />;

  const columns = [
    {
      key: "select",
      header: <Checkbox variant="square" checked={allPageSelected} disabled={!pageSelectable.length} onChange={togglePage} />,
      className: "w-10",
      render: (row) =>
        selectable(row) ? <Checkbox variant="square" checked={!!selected[row._id]} onChange={() => toggleRow(row)} /> : null,
    },
    {
      key: "fullName",
      header: t("lead.fullName"),
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-800 dark:text-slate-100">{row.fullName}</span>
          <span className="text-xs text-slate-400 dark:text-slate-500">{row.phone}</span>
        </div>
      ),
    },
    {
      key: "subject",
      header: t("lead.subject"),
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium text-slate-700 dark:text-slate-300">{subjectMap[row.subject]?.name || "—"}</span>
          {showCenter && <span className="text-xs text-slate-400 dark:text-slate-500">{centerMap[row.center]?.name}</span>}
        </div>
      ),
    },
    { key: "preference", header: t("lead.preference"), render: (row) => <span className="text-slate-600 dark:text-slate-300">{preference(row)}</span> },
    { key: "level", header: t("lead.level"), render: (row) => row.level || <span className="text-slate-300 dark:text-slate-600">—</span> },
    { key: "source", header: t("lead.source"), render: (row) => <span className="text-slate-600 dark:text-slate-300">{t(`lead.sources.${row.source}`)}</span> },
    { key: "status", header: t("lead.statusLabel"), render: statusChip },
    { key: "date", header: t("lead.date"), render: (row) => <span className="text-slate-500 dark:text-slate-400">{row.date?.split(" | ")[0]}</span> },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (row) => (rowMenu(row).length ? <DropMenu items={rowMenu(row)} /> : null),
    },
  ];

  const renderCard = (row) => (
    <div
      className={`flex flex-col gap-2.5 p-3.5 rounded-xl border bg-white dark:bg-night-900 transition-colors ${
        selected[row._id] ? "border-blue-400 bg-blue-50/40 dark:bg-blue-500/15" : "border-slate-200 dark:border-night-700"
      }`}
    >
      <div className="flex items-start gap-3">
        {selectable(row) && (
          <div className="pt-0.5">
            <Checkbox variant="square" checked={!!selected[row._id]} onChange={() => toggleRow(row)} />
          </div>
        )}
        <div className="flex-1 min-w-0" onClick={() => selectable(row) && toggleRow(row)}>
          <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{row.fullName}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">{row.phone}</p>
        </div>
        {statusChip(row)}
        {rowMenu(row).length > 0 && <DropMenu items={rowMenu(row)} />}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        <span className="font-semibold text-slate-700 dark:text-slate-300">{subjectMap[row.subject]?.name || "—"}</span>
        <span>{preference(row)}</span>
        {row.level && <span>{row.level}</span>}
      </div>
    </div>
  );

  const addButton = can("lead:create") && (
    <Button onClick={() => setLeadDialog({ lead: null })} className="gap-1.5">
      <HiPlus className="text-base" />
      {t("lead.create")}
    </Button>
  );

  const openTotal = summary.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="flex flex-col w-full h-full gap-4">
      {/* Fan bo'yicha kutayotganlar — qaysi fanga guruh yig'ish mumkinligini bir qarashda ko'rsatadi. */}
      {summary.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 -mb-0.5">
          <button
            type="button"
            onClick={() => setFilter("subject", "")}
            className={`shrink-0 flex items-center gap-2 h-9 pl-3 pr-2 rounded-lg border text-sm font-medium transition-colors cursor-pointer ${
              !filters.subject ? "bg-slate-900 border-slate-900 text-white" : "bg-white dark:bg-night-900 border-slate-200 dark:border-night-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-night-600"
            }`}
          >
            {t("lead.allWaiting")}
            <span className={`px-1.5 rounded-md text-xs font-semibold ${!filters.subject ? "bg-white/15 dark:bg-night-900/15" : "bg-slate-100 dark:bg-night-800"}`}>{openTotal}</span>
          </button>
          {summary.map((s) => {
            const on = filters.subject === s.subject;
            return (
              <button
                key={s.subject}
                type="button"
                onClick={() => setFilter("subject", on ? "" : s.subject)}
                className={`shrink-0 flex items-center gap-2 h-9 pl-3 pr-2 rounded-lg border text-sm font-medium transition-colors cursor-pointer ${
                  on ? "bg-blue-600 border-blue-600 text-white" : "bg-white dark:bg-night-900 border-slate-200 dark:border-night-700 text-slate-600 dark:text-slate-300 hover:border-blue-300"
                }`}
              >
                {subjectMap[s.subject]?.name || "—"}
                {showCenter && subjectMap[s.subject] && (
                  <span className={`text-xs ${on ? "text-blue-100" : "text-slate-400 dark:text-slate-500"}`}>{centerMap[subjectMap[s.subject].center]?.name}</span>
                )}
                <span className={`px-1.5 rounded-md text-xs font-semibold ${on ? "bg-white/20 dark:bg-night-900/20" : "bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400"}`}>{s.count}</span>
              </button>
            );
          })}
        </div>
      )}

      <FilterBar
        cols={4}
        activeCount={activeFilterCount}
        onReset={resetFilters}
        search={
          <Input
            placeholder={t("lead.searchPlaceholder")}
            icon={<HiMagnifyingGlass />}
            variant="slate"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        }
        actions={addButton}
      >
        {showCenter && (
          <Select
            placeholder={t("lead.center")}
            variant="slate"
            value={filters.center}
            onChange={(v) => setFilter("center", v)}
            options={[{ value: "", label: t("lead.allCenters") }, ...centers.map((c) => ({ value: c._id, label: c.name }))]}
          />
        )}
        <Select
          placeholder={t("lead.subject")}
          variant="slate"
          value={filters.subject}
          onChange={(v) => setFilter("subject", v)}
          options={[
            { value: "", label: t("lead.allSubjects") },
            ...subjects
              .filter((s) => !filters.center || s.center === filters.center)
              .map((s) => ({ value: s._id, label: showCenter ? `${s.name} · ${centerMap[s.center]?.name || ""}` : s.name })),
          ]}
        />
        <Select
          placeholder={t("lead.statusLabel")}
          variant="slate"
          value={filters.status}
          onChange={(v) => setFilter("status", v)}
          options={[
            { value: "", label: t("lead.statusOpen") },
            ...["new", "contacted", "enrolled", "rejected"].map((s) => ({ value: s, label: t(`lead.status.${s}`) })),
            { value: "all", label: t("lead.statusAll") },
          ]}
        />
        <Select
          placeholder={t("lead.preferredTime")}
          variant="slate"
          value={filters.time}
          onChange={(v) => setFilter("time", v)}
          options={[{ value: "", label: t("lead.anyTime") }, ...TIMES.filter((v) => v !== "any").map((v) => ({ value: v, label: t(`lead.time.${v}`) }))]}
        />
        <Select
          placeholder={t("lead.source")}
          variant="slate"
          value={filters.source}
          onChange={(v) => setFilter("source", v)}
          options={[{ value: "", label: t("lead.allSources") }, ...SOURCES.map((v) => ({ value: v, label: t(`lead.sources.${v}`) }))]}
        />
        <Input
          placeholder={t("lead.level")}
          variant="slate"
          value={filters.level}
          onChange={(e) => setFilter("level", e.target.value)}
        />
        <div className="sm:col-span-2">
          <DayPicker value={filters.days} onChange={(v) => setFilter("days", v)} />
        </div>
      </FilterBar>

      {error ? (
        <div className="flex flex-col items-center justify-center w-full flex-1 gap-3 text-slate-400 dark:text-slate-500">
          <HiInboxStack className="text-4xl" />
          <p className="text-sm">{t("lead.loadError")}</p>
          <Button variant="outlined" onClick={() => fetchLeads()}>
            {t("common.retry")}
          </Button>
        </div>
      ) : (
        <List
          columns={columns}
          rows={rows}
          loading={loading}
          view={isDesktop ? "table" : "grid"}
          renderItem={renderCard}
          gridClassName="grid grid-cols-1 gap-2 p-2"
          rowClassName={(row) => (selected[row._id] ? "!bg-blue-50/60 dark:bg-blue-500/15" : "")}
          empty={
            <div className="flex flex-col items-center gap-2 py-2 text-center">
              <HiOutlineViewfinderCircle className="text-3xl text-slate-300 dark:text-slate-600" />
              <span>{activeFilterCount || search ? t("lead.emptyFiltered") : t("lead.empty")}</span>
            </div>
          }
          page={meta.page}
          totalPages={meta.totalPages}
          onPageChange={setPage}
          showPagination
          toolbar={<span className="text-xs text-slate-400 dark:text-slate-500">{t("lead.total", { count: meta.total })}</span>}
        />
      )}

      {/* Tanlov paneli — belgilangan lid bo'lsagina chiqadi. */}
      {/* Mobilda panel tab-bar ustida qotib turadi — ro'yxat oxiri uning ostida qolmasin. */}
      {selectedList.length > 0 && <div className="h-32 sm:h-20 lg:hidden shrink-0" />}
      {selectedList.length > 0 && (
        <div className="max-lg:fixed max-lg:inset-x-3 max-lg:bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:sticky lg:bottom-0 z-2 flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl bg-slate-900 text-white shadow-lg shadow-slate-900/20">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="flex items-center justify-center shrink-0 min-w-8 h-8 px-2 rounded-lg bg-blue-600 text-sm font-semibold">
              {selectedList.length}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">
                {mixed
                  ? t("lead.selectedMixed")
                  : `${subjectMap[selSubjects[0]]?.name || ""}${showCenter ? ` · ${centerMap[selCenters[0]]?.name || ""}` : ""}`}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{mixed ? t("lead.selectedMixedHint") : t("lead.selectedHint")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canCreateGroup && (
              <Button disabled={mixed} onClick={() => openEnroll("new")} className="gap-1.5 flex-1 sm:flex-none">
                <HiCheck className="text-base" />
                {t("lead.newGroup")}
              </Button>
            )}
            {canEnroll && (
              <Button
                variant="outlined"
                color="slate"
                disabled={mixed}
                onClick={() => openEnroll("existing")}
                className="flex-1 sm:flex-none !bg-white/5 !text-white !border-white/20 hover:!bg-white/10"
              >
                {t("lead.existingGroup")}
              </Button>
            )}
            <button
              type="button"
              title={t("lead.clearSelection")}
              onClick={() => setSelected({})}
              className="flex items-center justify-center shrink-0 w-9 h-9 rounded-lg text-slate-400 dark:text-slate-500 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <HiXMark className="text-lg" />
            </button>
          </div>
        </div>
      )}

      {leadDialogView && (
        <LeadDialog
          key={leadDialogView.lead?._id || "new"}
          open={!!leadDialog}
          lead={leadDialogView.lead}
          centers={centers}
          subjects={subjects}
          defaultSubject={filters.subject}
          onClose={() => setLeadDialog(null)}
          onSaved={() => fetchLeads(true)}
        />
      )}

      {enrollView && (
        <EnrollDialog
          key={enrollView.mode}
          open={!!enroll}
          mode={enrollView.mode}
          leads={enrollView.leads}
          subject={enrollView.subject}
          center={enrollView.center}
          teachers={teachers}
          assistants={assistants}
          rooms={rooms}
          onClose={closeEnroll}
          onDone={() => fetchLeads(true)}
        />
      )}

      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t("lead.deleteTitle")}
        description={t("lead.deleteDesc", { name: deleteTargetView?.fullName || "" })}
        actions={
          <>
            <Button color="black" variant="text" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button color="red" loading={deleting} onClick={confirmDelete}>
              {t("common.delete")}
            </Button>
          </>
        }
      >
        <span />
      </Dialog>
    </div>
  );
}

export default Leads;
